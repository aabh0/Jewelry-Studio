import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { env, dbPath } from "@/env";
import { ffmpegPath } from "@/providers/local/ffmpeg";
import { ffprobePath } from "@/providers/local/ffprobe";
import { findCli, authState } from "@/providers/higgsfield/cli/adapter";
import { cloudClient } from "@/providers/higgsfield/cloud/client";
import { claudeAvailable } from "@/providers/claude/client";

const live = process.argv.includes("--live");
const ok = (s: string) => console.log(`  ✓ ${s}`);
const bad = (s: string) => console.log(`  ✗ ${s}`);

async function main() {
  console.log("Jewelry Studio doctor\n");
  console.log(`Node ${process.version} on ${process.platform}/${process.arch}`);
  console.log(`DATA_DIR: ${env.DATA_DIR}${fs.existsSync(env.DATA_DIR) ? "" : " (will be created)"}`);
  console.log(`DB: ${dbPath()}`);
  for (const [name, p] of [["ffmpeg", ffmpegPath()], ["ffprobe", ffprobePath()]] as const) {
    try { const v = execFileSync(p, ["-version"], { encoding: "utf8" }).split("\n")[0]; ok(`${name}: ${v} (${p})`); } catch { bad(`${name} not runnable at ${p}`); }
  }
  console.log("\nLanes");
  if (cloudClient().available) ok("Cloud API credentials present"); else bad("Cloud API credentials missing (HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET)");
  const cli = findCli();
  if (!cli) bad("Higgsfield CLI not found (optional): npm i -g @higgsfield/cli@1.1.26 && higgsfield auth login");
  else { const st = await authState(); if (st === "ok") ok(`Higgsfield CLI logged in (${cli})`); else bad(`Higgsfield CLI at ${cli}: ${st}`); }
  if (claudeAvailable()) ok("Anthropic key present"); else bad("ANTHROPIC_API_KEY missing");
  if (env.MOCK_PROVIDERS) console.log("  (MOCK_PROVIDERS=1: all providers are mocked)");
  if (live && cloudClient().available) {
    console.log("\nLive checks");
    try { const e = await cloudClient().estimate("marketing-studio/image/flare", { prompt: "probe", resolution: "2k", quality: "high", aspect_ratio: "1:1" }); ok(`Cloud estimate: $${e.usd ?? "formula"}`); } catch (e) { bad(`Cloud estimate failed: ${(e as Error).message}`); }
  }
  console.log("\nDone.");
}
main();
