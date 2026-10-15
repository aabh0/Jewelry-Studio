import { route, json, db } from "@/server/http";
import { laneStatus } from "@/providers/capability";
import { env } from "@/env";
import { ffmpegPath } from "@/providers/local/ffmpeg";
import { getSetting, spendToday } from "@/server/settings";
import { countActiveJobs } from "@/queue/enqueue";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const d = db();
  const lanes = await laneStatus();
  return json({ ok: true, version: "0.1.0", dataDir: env.DATA_DIR, mock: env.MOCK_PROVIDERS, lanes, ffmpeg: ffmpegPath(), integrity: getSetting(d, "integrity_check", null), spendToday: spendToday(d), activeJobs: countActiveJobs(d), now: Date.now() });
});
