import { eq, gte, and, desc, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { settings, uiState, ledger } from "@/db/schema";
import { startOfTodayMs } from "@/lib/money";
import { env } from "@/env";
import type { Overrides } from "@/providers/capability";

export function getSetting<T>(db: DB, key: string, fallback: T): T {
  const r = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!r) return fallback;
  try {
    return JSON.parse(r.valueJson) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(db: DB, key: string, value: unknown): void {
  db.insert(settings).values({ key, valueJson: JSON.stringify(value), updatedAt: Date.now() }).onConflictDoUpdate({ target: settings.key, set: { valueJson: JSON.stringify(value), updatedAt: Date.now() } }).run();
}

export function allSettings(db: DB): Record<string, unknown> {
  const rows = db.select().from(settings).all();
  return Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.valueJson)]));
}

export function capabilityOverrides(db: DB): Overrides {
  return getSetting<Overrides>(db, "capability_overrides", {});
}

export function dailyCapUsd(db: DB): number {
  return getSetting<number>(db, "daily_cap_usd", env.DAILY_SPEND_CAP_USD);
}

export function getUiState(db: DB, scope: string): unknown {
  const r = db.select().from(uiState).where(eq(uiState.scope, scope)).get();
  return r ? JSON.parse(r.dataJson) : null;
}

export function setUiState(db: DB, scope: string, data: unknown, merge = true): unknown {
  const cur = merge ? (getUiState(db, scope) as Record<string, unknown> | null) : null;
  const next = merge && cur && data && typeof data === "object" ? { ...cur, ...(data as Record<string, unknown>) } : data;
  db.insert(uiState).values({ scope, dataJson: JSON.stringify(next), updatedAt: Date.now() }).onConflictDoUpdate({ target: uiState.scope, set: { dataJson: JSON.stringify(next), updatedAt: Date.now() } }).run();
  return next;
}

export function spendToday(db: DB): number {
  const r = db.select({ s: sql<number>`coalesce(sum(coalesce(actual_usd, estimate_usd)),0)` }).from(ledger).where(and(gte(ledger.at, startOfTodayMs()), eq(ledger.currency, "usd"))).get();
  return +(r?.s ?? 0).toFixed(4);
}

export function spendSummary(db: DB) {
  const today = spendToday(db);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const month = db.select({ s: sql<number>`coalesce(sum(coalesce(actual_usd, estimate_usd)),0)` }).from(ledger).where(and(gte(ledger.at, monthStart.getTime()), eq(ledger.currency, "usd"))).get()?.s ?? 0;
  const creditsToday = db.select({ s: sql<number>`coalesce(sum(credits),0)` }).from(ledger).where(and(gte(ledger.at, startOfTodayMs()), eq(ledger.currency, "credits"))).get()?.s ?? 0;
  const byLane = db.select({ lane: ledger.lane, s: sql<number>`coalesce(sum(coalesce(actual_usd, estimate_usd)),0)`, credits: sql<number>`coalesce(sum(credits),0)`, n: sql<number>`count(*)` }).from(ledger).where(gte(ledger.at, monthStart.getTime())).groupBy(ledger.lane).all();
  const byModel = db.select({ model: ledger.modelId, s: sql<number>`coalesce(sum(coalesce(actual_usd, estimate_usd)),0)`, n: sql<number>`count(*)` }).from(ledger).where(gte(ledger.at, monthStart.getTime())).groupBy(ledger.modelId).orderBy(desc(sql`sum(coalesce(actual_usd, estimate_usd))`)).limit(10).all();
  return { todayUsd: today, monthUsd: +month.toFixed(2), creditsToday, cap: dailyCapUsd(db), byLane, byModel };
}

export function ledgerRows(db: DB, opts: { projectId?: string; from?: number; to?: number; limit?: number }) {
  const conds = [];
  if (opts.projectId) conds.push(eq(ledger.projectId, opts.projectId));
  if (opts.from) conds.push(gte(ledger.at, opts.from));
  if (opts.to) conds.push(sql`${ledger.at} <= ${opts.to}`);
  return db.select().from(ledger).where(conds.length ? and(...conds) : undefined).orderBy(desc(ledger.at)).limit(opts.limit ?? 200).all();
}
