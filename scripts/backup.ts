import { config as loadEnv } from "dotenv";
loadEnv({ path: [".env.local", ".env"], quiet: true });
import path from "node:path";
import fs from "node:fs";
import { getSqlite } from "@/db/client";
import { dirs } from "@/lib/files";

async function main() {
  fs.mkdirSync(dirs.backups(), { recursive: true });
  const dest = path.join(dirs.backups(), `studio-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`);
  await getSqlite().backup(dest);
  console.log(`backup written: ${dest}`);
}
main();
