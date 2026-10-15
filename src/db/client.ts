import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { dbPath } from "@/env";
import { runMigrations } from "./migrate";

export type DB = BetterSQLite3Database<typeof schema>;

let _sqlite: Database.Database | null = null;
let _db: DB | null = null;

export function openSqlite(file = dbPath()): Database.Database {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file, { timeout: 5000 });
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("wal_autocheckpoint = 1000");
  return sqlite;
}

export function getSqlite(): Database.Database {
  if (!_sqlite) _sqlite = openSqlite();
  return _sqlite;
}

export function getDb(): DB {
  if (!_db) {
    _db = drizzle(getSqlite(), { schema });
    // Both processes (app and worker) migrate on first open so neither depends on the other's boot order.
    // The migrator is idempotent and runs in a transaction; busy_timeout covers the two racing.
    runMigrations(_db);
  }
  return _db;
}

/** For tests: create an isolated database (file or :memory:). */
export function createDb(file: string): { db: DB; sqlite: Database.Database } {
  const sqlite = file === ":memory:" ? new Database(":memory:") : openSqlite(file);
  if (file === ":memory:") sqlite.pragma("foreign_keys = ON");
  return { db: drizzle(sqlite, { schema }), sqlite };
}

export function closeDb(): void {
  _sqlite?.close();
  _sqlite = null;
  _db = null;
}

export { schema };
