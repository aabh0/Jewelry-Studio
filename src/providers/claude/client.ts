import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@/env";
import type { DB } from "@/db/client";
import { claudeRuns } from "@/db/schema";
import { newId } from "@/lib/ids";
import { forVision } from "@/providers/local/sharp";

export type ImageInput = { path: string; label: string; maxEdge?: number };

export interface ClaudeCallOptions<T> {
  purpose: string;
  model?: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  system: string;
  task: string;
  images?: ImageInput[];
  schema: z.ZodType<T>;
  db?: DB;
  cacheSystem?: boolean;
}

export class ClaudeError extends Error {
  constructor(message: string, readonly code: "missing_key" | "refusal" | "parse" | "api") {
    super(message);
    this.name = "ClaudeError";
  }
}

const PRICES: Record<string, { in: number; out: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

export function craftGuidance(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.join(here, "prompts", "craft.md"), path.resolve(process.cwd(), "src/providers/claude/prompts/craft.md")];
  for (const c of candidates) if (fs.existsSync(c)) return fs.readFileSync(c, "utf8");
  throw new Error("craft.md not found");
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new ClaudeError("ANTHROPIC_API_KEY is not set.", "missing_key");
  if (!_client) _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 10 * 60 * 1000 });
  return _client;
}

export function claudeAvailable(): boolean {
  return !!env.ANTHROPIC_API_KEY;
}

export function costUsd(model: string, usage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): number {
  const p = PRICES[model] ?? PRICES["claude-sonnet-5-5"];
  const inTok = usage.input_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  const cr = usage.cache_read_input_tokens ?? 0;
  const cw = usage.cache_creation_input_tokens ?? 0;
  return +((inTok * p.in + out * p.out + cr * p.cacheRead + cw * p.cacheWrite) / 1_000_000).toFixed(5);
}

/** Structured call. Images are downscaled and placed before the text. */
export async function callStructured<T>(opts: ClaudeCallOptions<T>): Promise<{ data: T; usage: Record<string, number | null | undefined>; costUsd: number; runId: string }> {
  const model = opts.model ?? env.CLAUDE_DIRECTOR_MODEL;
  const runId = newId();
  const content: Anthropic.Messages.ContentBlockParam[] = [];
  for (const img of opts.images ?? []) {
    const v = await forVision(img.path, img.maxEdge ?? 1092);
    content.push({ type: "text", text: img.label });
    content.push({ type: "image", source: { type: "base64", media_type: v.mediaType, data: v.base64 } });
  }
  content.push({ type: "text", text: opts.task });
  const system: Anthropic.Messages.TextBlockParam[] = [
    opts.cacheSystem === false ? { type: "text", text: opts.system } : { type: "text", text: opts.system, cache_control: { type: "ephemeral", ttl: "1h" } as never },
  ];
  const started = Date.now();
  try {
    // messages.parse + zodOutputFormat per the Anthropic SDK structured-output helper.
    const res = await client().messages.parse({
      model,
      max_tokens: opts.maxTokens ?? 8000,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort: opts.effort ?? "medium", format: zodOutputFormat(opts.schema) } as never,
    } as never);
    const r = res as unknown as { stop_reason: string; parsed_output: T | null; usage: Record<string, number | null | undefined> };
    const usage = r.usage ?? {};
    const cost = costUsd(model, usage as never);
    if (r.stop_reason === "refusal") {
      record(opts.db, { id: runId, purpose: opts.purpose, model, inputJson: opts.task.slice(0, 4000), outputJson: null, usageJson: JSON.stringify(usage), costUsd: cost, status: "refusal", error: "refusal" });
      throw new ClaudeError("The model declined this request.", "refusal");
    }
    if (!r.parsed_output) {
      record(opts.db, { id: runId, purpose: opts.purpose, model, inputJson: opts.task.slice(0, 4000), outputJson: null, usageJson: JSON.stringify(usage), costUsd: cost, status: "parse_error", error: "no parsed output" });
      throw new ClaudeError("The model returned output that did not match the schema.", "parse");
    }
    record(opts.db, { id: runId, purpose: opts.purpose, model, inputJson: opts.task.slice(0, 4000), outputJson: JSON.stringify(r.parsed_output).slice(0, 200_000), usageJson: JSON.stringify({ ...usage, ms: Date.now() - started }), costUsd: cost, status: "ok", error: null });
    return { data: r.parsed_output, usage, costUsd: cost, runId };
  } catch (err) {
    if (err instanceof ClaudeError) throw err;
    const e = err as Error;
    record(opts.db, { id: runId, purpose: opts.purpose, model, inputJson: opts.task.slice(0, 4000), outputJson: null, usageJson: null, costUsd: 0, status: "error", error: e.message });
    throw new ClaudeError(`Claude API error: ${e.message}`, "api");
  }
}

function record(db: DB | undefined, row: { id: string; purpose: string; model: string; inputJson: string | null; outputJson: string | null; usageJson: string | null; costUsd: number; status: string; error: string | null }): void {
  if (!db) return;
  db.insert(claudeRuns).values({ ...row, createdAt: Date.now() }).run();
}
