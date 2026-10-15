import path from "node:path";
import fs from "node:fs/promises";
import type { HandlerSpec } from "@/queue/types";
import { env } from "@/env";
import { dirs } from "@/lib/files";
import { dbPath } from "@/env";
import { getSqlite } from "@/db/client";
import { setSetting } from "@/server/settings";
import { cloudClient } from "@/providers/higgsfield/cloud/client";
import { LEGACY_PROBE_IDS } from "@/providers/higgsfield/cloud/endpoints";
import { laneStatus } from "@/providers/capability";
import { cliModelGet, runCli, findCli } from "@/providers/higgsfield/cli/adapter";
import { claudeAvailable, callStructured, craftGuidance } from "@/providers/claude/client";
import { z } from "zod";
import { ingestUpload } from "@/server/assets";

export const providerProbe: HandlerSpec<Record<string, never>> = {
  lane: "provider",
  maxAttempts: 1,
  run: async (ctx) => {
    const report: Record<string, unknown> = { at: new Date().toISOString(), mock: env.MOCK_PROVIDERS };
    const status = await laneStatus(true);
    report.lanes = status;
    const lines: string[] = [`# Provider probe — ${report.at}`, ""];
    if (status.cloud.available && !env.MOCK_PROVIDERS) {
      ctx.progress(10, "Probing Cloud API");
      const c = cloudClient();
      const est = await c.estimate("marketing-studio/image/flare", { prompt: "probe", resolution: "2k", quality: "high", aspect_ratio: "1:1" }).catch((e) => ({ error: (e as Error).message }));
      report.cloud_estimate_flare = est;
      lines.push(`- Cloud estimate flare 2k: ${JSON.stringify(est)}`);
      const legacy: Record<string, unknown> = {};
      for (const id of LEGACY_PROBE_IDS) {
        const r = await c.estimate(id, { prompt: "probe" }).then((x) => ({ ok: true, usd: x.usd })).catch((e) => ({ ok: false, error: (e as Error).message.slice(0, 120) }));
        legacy[id] = r;
        lines.push(`- Legacy ${id}: ${JSON.stringify(r)}`);
      }
      report.cloud_legacy = legacy;
      setSetting(ctx.db, "cloud_probe", { legacy, at: Date.now() });
    } else lines.push(`- Cloud: ${status.cloud.available ? "available (mock)" : status.cloud.reason}`);
    if (status.cli.available && !env.MOCK_PROVIDERS) {
      ctx.progress(50, "Probing Higgsfield CLI");
      const schemas: Record<string, unknown> = {};
      for (const jst of ["gpt_image_2_5", "nano_banana_2", "gpt_image_2", "image_background_remover", "outpaint", "topaz_image", "bytedance_image_upscale", "video_upscale", "topaz_video", "kling3_0", "seedance_2_5"]) {
        try { schemas[jst] = await cliModelGet(jst); } catch (e) { schemas[jst] = { error: (e as Error).message }; }
      }
      setSetting(ctx.db, "cli_schemas", schemas);
      const acct = await runCli(["account", "status", "--json"], { timeoutMs: 30_000 }).catch(() => null);
      report.cli_account = acct?.stdout?.slice(0, 2000);
      lines.push(`- CLI at ${findCli()}: account status captured; ${Object.keys(schemas).length} model schemas stored in settings.cli_schemas`);
    } else lines.push(`- CLI: ${status.cli.reason ?? status.cli.state}`);
    if (claudeAvailable() && !env.MOCK_PROVIDERS) {
      ctx.progress(80, "Probing Claude");
      try {
        const r1 = await callStructured({ purpose: "probe", model: env.CLAUDE_QA_MODEL, effort: "low", maxTokens: 200, system: craftGuidance(), task: "Reply with {ok:true}.", schema: z.object({ ok: z.boolean() }), db: ctx.db });
        const r2 = await callStructured({ purpose: "probe", model: env.CLAUDE_QA_MODEL, effort: "low", maxTokens: 200, system: craftGuidance(), task: "Reply with {ok:true} again.", schema: z.object({ ok: z.boolean() }), db: ctx.db });
        report.claude = { ok: r1.data.ok && r2.data.ok, cache_read_second_call: r2.usage.cache_read_input_tokens };
        lines.push(`- Claude: ok; cache_read_input_tokens on second call = ${r2.usage.cache_read_input_tokens}`);
      } catch (e) { report.claude = { error: (e as Error).message }; lines.push(`- Claude error: ${(e as Error).message}`); }
    }
    const probesDir = path.resolve(process.cwd(), "docs", "probes");
    try { await fs.mkdir(probesDir, { recursive: true }); await fs.writeFile(path.join(probesDir, `probe-${Date.now()}.md`), lines.join("\n") + "\n\n```json\n" + JSON.stringify(report, null, 2) + "\n```\n"); } catch { /* read-only install is fine */ }
    setSetting(ctx.db, "last_probe", report);
    return report;
  },
};

export const backupSnapshot: HandlerSpec<Record<string, never>> = {
  lane: "local",
  maxAttempts: 1,
  run: async (ctx) => {
    await fs.mkdir(dirs.backups(), { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const dest = path.join(dirs.backups(), `studio-${stamp}.sqlite`);
    await getSqlite().backup(dest);
    const files = (await fs.readdir(dirs.backups())).filter((f) => f.startsWith("studio-") && f.endsWith(".sqlite")).sort();
    for (const f of files.slice(0, Math.max(0, files.length - 14))) await fs.unlink(path.join(dirs.backups(), f)).catch(() => {});
    ctx.emit("log", { line: `backup written to ${dest} (source ${dbPath()})` });
    return { dest };
  },
};

export const assetIngest: HandlerSpec<{ project_id: string; tmp_path: string; original_name: string; role?: string }> = {
  lane: "local",
  maxAttempts: 1,
  run: async (ctx) => {
    const a = await ingestUpload(ctx.db, ctx.payload.project_id, ctx.payload.tmp_path, ctx.payload.original_name, ctx.payload.role ?? "upload");
    ctx.emit("artifact", { asset_id: a.id });
    return { asset_id: a.id };
  },
};
