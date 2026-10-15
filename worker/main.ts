import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });
import fs from "node:fs";
import path from "node:path";
import { getDb, getSqlite, closeDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { ensureDataDirs, dirs } from "@/lib/files";
import { log } from "@/lib/log";
import { env } from "@/env";
import { Worker } from "@/queue/worker";
import { handlers } from "@/queue/handlers";
import { enqueue } from "@/queue/enqueue";

async function main() {
  ensureDataDirs();
  const db = getDb();
  runMigrations(db);
  // integrity check (result surfaced in Settings)
  try {
    const r = getSqlite().pragma("integrity_check") as { integrity_check: string }[];
    const { setSetting } = await import("@/server/settings");
    setSetting(db, "integrity_check", { result: r[0]?.integrity_check ?? "unknown", at: Date.now() });
  } catch (e) {
    log.warn({ err: (e as Error).message }, "integrity check failed");
  }
  // clear tmp
  try { fs.rmSync(dirs.tmp(), { recursive: true, force: true }); fs.mkdirSync(dirs.tmp(), { recursive: true }); } catch { /* ignore */ }
  const worker = new Worker({ db, handlers });
  const swept = worker.sweepStale(true);
  if (swept) log.info({ swept }, "requeued stale jobs");
  worker.start();
  log.info({ dataDir: env.DATA_DIR, mock: env.MOCK_PROVIDERS, workerId: worker.workerId }, "worker started");
  // nightly backup: enqueue once per day
  const dayKey = () => new Date().toISOString().slice(0, 10);
  const scheduleBackup = () => enqueue(db, "backup.snapshot", {}, { idempotencyKey: `backup-${dayKey()}`, priority: -5, label: "Nightly backup" });
  scheduleBackup();
  const backupTimer = setInterval(scheduleBackup, 6 * 60 * 60 * 1000);
  // wake on demand: the Next process touches a file after enqueue (cheap cross-process signal)
  const wakeFile = path.join(dirs.tmp(), "..", "wake");
  try { fs.watchFile(wakeFile, { interval: 300 }, () => worker.wake()); } catch { /* ignore */ }
  const shutdown = async (sig: string) => {
    log.info({ sig }, "worker shutting down");
    clearInterval(backupTimer);
    await worker.stop();
    closeDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  log.error({ err: (err as Error).message, stack: (err as Error).stack }, "worker crashed");
  process.exit(1);
});
