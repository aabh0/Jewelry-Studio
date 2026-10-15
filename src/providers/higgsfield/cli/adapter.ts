import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { env } from "@/env";
import { dirs } from "@/lib/files";
import { log } from "@/lib/log";
import { parseCliJson, extractResultUrls, type CliJobResult } from "./parse";

export type CliAuthState = "ok" | "needs_login" | "not_installed" | "unknown";

export class CliError extends Error {
  constructor(message: string, readonly code: "not_installed" | "needs_login" | "failed" | "timeout" | "cancelled" | "parse", readonly stderr = "") {
    super(message);
    this.name = "CliError";
  }
}

const CANDIDATE_DIRS = process.platform === "win32"
  ? [path.join(process.env.APPDATA ?? "", "npm"), path.join(process.env.ProgramFiles ?? "", "nodejs")]
  : ["/usr/local/bin", "/opt/homebrew/bin", path.join(os.homedir(), ".npm-global", "bin"), path.join(os.homedir(), ".local", "bin"), "/usr/bin"];

export function findCli(): string | null {
  if (env.HIGGSFIELD_CLI_PATH && fs.existsSync(env.HIGGSFIELD_CLI_PATH)) return env.HIGGSFIELD_CLI_PATH;
  const names = process.platform === "win32" ? ["higgsfield.cmd", "higgsfield.exe", "higgsfield"] : ["higgsfield"];
  const pathDirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const d of [...pathDirs, ...CANDIDATE_DIRS]) {
    for (const n of names) {
      const p = path.join(d, n);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

export interface RunOptions {
  timeoutMs?: number;
  cwd?: string;
  logName?: string;
  signal?: AbortSignal;
  onLine?: (line: string) => void;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function runCli(args: string[], opts: RunOptions = {}): Promise<RunResult> {
  const bin = findCli();
  if (!bin) throw new CliError("Higgsfield CLI not found. Install with `npm i -g @higgsfield/cli@1.1.26` and run `higgsfield auth login`.", "not_installed");
  const logDir = path.join(dirs.logs(), "cli");
  fs.mkdirSync(logDir, { recursive: true });
  const logStream = opts.logName ? fs.createWriteStream(path.join(logDir, `${opts.logName}.log`), { flags: "a" }) : null;
  logStream?.write(`\n$ higgsfield ${args.join(" ")}\n`);
  const isCmd = process.platform === "win32" && bin.toLowerCase().endsWith(".cmd");
  const spawnBin = isCmd ? process.env.ComSpec ?? "cmd.exe" : bin;
  const spawnArgs = isCmd ? ["/c", bin, ...args] : args;
  return new Promise((resolve, reject) => {
    const child = spawn(spawnBin, spawnArgs, { cwd: opts.cwd, windowsHide: true, env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = opts.timeoutMs ? setTimeout(() => { child.kill("SIGKILL"); reject(new CliError("CLI command timed out", "timeout")); }, opts.timeoutMs) : null;
    const onAbort = () => { child.kill("SIGKILL"); reject(new CliError("cancelled", "cancelled")); };
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (d: Buffer) => { const s = d.toString(); stdout += s; logStream?.write(s); s.split("\n").forEach((l) => l && opts.onLine?.(l)); });
    child.stderr.on("data", (d: Buffer) => { const s = d.toString(); stderr += s; logStream?.write(s); });
    child.on("error", (e) => { if (timer) clearTimeout(timer); logStream?.end(); reject(new CliError(e.message, "failed")); });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      logStream?.end();
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

export function detectAuthError(r: RunResult): boolean {
  const s = (r.stderr + "\n" + r.stdout).toLowerCase();
  return /session expired|not authenticated|unauthorized|please run.*auth login|login required/.test(s);
}

export async function authState(): Promise<CliAuthState> {
  if (!findCli()) return "not_installed";
  try {
    const r = await runCli(["account", "status", "--json"], { timeoutMs: 30_000 });
    if (detectAuthError(r)) return "needs_login";
    if (r.code === 0) return "ok";
    return "unknown";
  } catch (err) {
    if (err instanceof CliError && err.code === "not_installed") return "not_installed";
    return "unknown";
  }
}

export interface CliGenerateOptions {
  jobSetType: string;
  prompt?: string;
  flags?: Record<string, string | number | boolean | undefined>;
  media?: { flag: string; path: string }[]; // e.g. {flag:"--image", path}
  workflow?: boolean;
  timeoutMs?: number;
  logName?: string;
  signal?: AbortSignal;
  onLine?: (line: string) => void;
}

function toArgs(o: CliGenerateOptions): string[] {
  const args = ["generate", o.workflow ? "workflow" : "create", o.jobSetType];
  if (o.prompt !== undefined) args.push("--prompt", o.prompt);
  for (const m of o.media ?? []) args.push(m.flag, m.path);
  for (const [k, v] of Object.entries(o.flags ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    args.push(k.startsWith("--") ? k : `--${k}`, String(v));
  }
  return args;
}

export async function cliEstimateCredits(o: CliGenerateOptions): Promise<number | null> {
  const args = ["generate", "cost", ...(o.workflow ? ["workflow"] : []), o.jobSetType];
  if (o.prompt !== undefined) args.push("--prompt", o.prompt);
  for (const [k, v] of Object.entries(o.flags ?? {})) if (v !== undefined && v !== "") args.push(k.startsWith("--") ? k : `--${k}`, String(v));
  args.push("--json");
  try {
    const r = await runCli(args, { timeoutMs: 60_000 });
    if (r.code !== 0) return null;
    const j = parseCliJson(r.stdout) as Record<string, unknown> | null;
    if (!j) return null;
    const c = (j.credits ?? j.cost ?? j.estimate ?? j.price) as number | string | undefined;
    const n = c !== undefined ? Number(c) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Submit and wait. Returns result URLs and the raw job object. */
export async function cliGenerate(o: CliGenerateOptions): Promise<CliJobResult> {
  const args = [...toArgs(o), "--wait", "--wait-timeout", `${Math.ceil((o.timeoutMs ?? 20 * 60_000) / 60_000)}m`, "--wait-interval", "5s", "--json"];
  const r = await runCli(args, { timeoutMs: (o.timeoutMs ?? 20 * 60_000) + 60_000, logName: o.logName, signal: o.signal, onLine: o.onLine });
  if (detectAuthError(r)) throw new CliError("Higgsfield CLI session expired. Run `higgsfield auth login` in a terminal, then retry.", "needs_login", r.stderr);
  if (r.code !== 0) throw new CliError(`Higgsfield CLI failed (${r.code}): ${(r.stderr || r.stdout).trim().split("\n").slice(-4).join(" | ")}`, "failed", r.stderr);
  const json = parseCliJson(r.stdout);
  if (!json) throw new CliError("Could not parse CLI JSON output", "parse", r.stdout.slice(-2000));
  const urls = extractResultUrls(json);
  if (urls.length === 0) throw new CliError("CLI job finished without a result URL", "failed", r.stdout.slice(-2000));
  return { urls, raw: json, jobId: findJobId(json) };
}

function findJobId(json: unknown): string | undefined {
  const first = Array.isArray(json) ? json[0] : json;
  if (first && typeof first === "object") {
    const o = first as Record<string, unknown>;
    for (const k of ["job_id", "id", "jobId"]) if (typeof o[k] === "string") return o[k] as string;
  }
  return undefined;
}

export async function cliSoulCreate(name: string, images: string[], variant: "soul-2" | "soul-cinematic" = "soul-2"): Promise<string> {
  const args = ["soul-id", "create", "--name", name, `--${variant}`];
  for (const i of images) args.push("--image", i);
  args.push("--json");
  const r = await runCli(args, { timeoutMs: 10 * 60_000, logName: `soul-${name}` });
  if (detectAuthError(r)) throw new CliError("Higgsfield CLI session expired. Run `higgsfield auth login`.", "needs_login");
  if (r.code !== 0) throw new CliError(`soul-id create failed: ${r.stderr.trim().slice(-500)}`, "failed");
  const json = parseCliJson(r.stdout) as Record<string, unknown> | null;
  const id = json ? ((json.reference_id ?? json.id ?? json.soul_id) as string | undefined) : undefined;
  if (!id) throw new CliError("soul-id create returned no id", "parse", r.stdout.slice(-1000));
  return id;
}

export async function cliSoulWait(id: string): Promise<void> {
  const r = await runCli(["soul-id", "wait", id, "--json"], { timeoutMs: 40 * 60_000, logName: `soul-wait-${id}` });
  if (r.code !== 0) throw new CliError(`soul-id wait failed: ${r.stderr.trim().slice(-500)}`, "failed");
}

export async function cliModelGet(jst: string): Promise<unknown> {
  const r = await runCli(["model", "get", jst, "--json"], { timeoutMs: 60_000 });
  if (r.code !== 0) throw new CliError(`model get ${jst} failed`, "failed", r.stderr);
  return parseCliJson(r.stdout);
}

export async function cliDownload(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new CliError(`Download failed ${res.status}`, "failed");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  log.debug({ url, dest }, "cli download ok");
}
