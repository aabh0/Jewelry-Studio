import { route, json, db, body } from "@/server/http";
import { allSettings, setSetting } from "@/server/settings";
import { env } from "@/env";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const GET = route(async () => json({ settings: allSettings(db()), env: { dataDir: env.DATA_DIR, hasCloudKey: !!env.HIGGSFIELD_API_KEY, hasAnthropicKey: !!env.ANTHROPIC_API_KEY, cliPath: env.HIGGSFIELD_CLI_PATH ?? null, directorModel: env.CLAUDE_DIRECTOR_MODEL, qaModel: env.CLAUDE_QA_MODEL, mock: env.MOCK_PROVIDERS, concurrency: { provider: env.WORKER_CONCURRENCY_PROVIDER, ffmpeg: env.WORKER_CONCURRENCY_FFMPEG, claude: env.WORKER_CONCURRENCY_CLAUDE }, capDefault: env.DAILY_SPEND_CAP_USD } }));
export const PUT = route(async (req) => { const b = await body(req, z.record(z.string(), z.unknown())); for (const [k, v] of Object.entries(b)) setSetting(db(), k, v); return json({ settings: allSettings(db()) }); });
