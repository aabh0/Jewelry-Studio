import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "./client";

export function migrationsFolder(): string {
  // Works from src (tsx) and from the Next server bundle because both fall back to the repo root (cwd).
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../drizzle"), path.resolve(here, "../../../drizzle"), path.resolve(process.cwd(), "drizzle")];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "meta", "_journal.json"))) return c;
  }
  return path.resolve(process.cwd(), "drizzle");
}

export function runMigrations(db: DB): void {
  migrate(db, { migrationsFolder: migrationsFolder() });
}

// CLI entry: pnpm db:migrate
if (process.argv[1] && /migrate\.(ts|js)$/.test(process.argv[1])) {
  const { getDb } = await import("./client");
  runMigrations(getDb());
  console.log("migrations applied");
}
