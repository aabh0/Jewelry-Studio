import { eq, and, inArray, sql } from "drizzle-orm";
import crypto from "node:crypto";
import type { DB } from "@/db/client";
import { jobs, jobEvents } from "@/db/schema";
import { newId } from "@/lib/ids";
import { canonicalJson } from "@/lib/json";
import type { JobType, JobStatus } from "./types";

export interface EnqueueOptions {
  idempotencyKey?: string | null; // null = no idempotency
  priority?: number;
  parentId?: string;
  runAfter?: number;
  maxAttempts?: number;
  projectId?: string;
  campaignId?: string;
  label?: string;
}

export function defaultIdempotencyKey(type: JobType, payload: unknown): string {
  return crypto.createHash("sha256").update(type + "\n" + canonicalJson(payload)).digest("hex");
}

/** Insert a job, returning the id. If an idempotency key matches, returns the existing job id. */
export function enqueue(db: DB, type: JobType, payload: unknown, opts: EnqueueOptions = {}): { id: string; existed: boolean } {
  const key = opts.idempotencyKey === null ? null : (opts.idempotencyKey ?? defaultIdempotencyKey(type, payload));
  if (key) {
    const existing = db.select({ id: jobs.id, status: jobs.status }).from(jobs).where(eq(jobs.idempotencyKey, key)).get();
    if (existing && existing.status !== "failed" && existing.status !== "cancelled") return { id: existing.id, existed: true };
    if (existing) {
      // allow retry of a failed/cancelled job with the same key: free the key
      db.update(jobs).set({ idempotencyKey: null }).where(eq(jobs.id, existing.id)).run();
    }
  }
  const id = newId();
  const now = Date.now();
  db.insert(jobs)
    .values({
      id,
      type,
      payloadJson: JSON.stringify(payload ?? {}),
      idempotencyKey: key,
      status: "queued",
      priority: opts.priority ?? 0,
      attempts: 0,
      maxAttempts: opts.maxAttempts ?? 3,
      runAfter: opts.runAfter ?? now,
      parentId: opts.parentId ?? null,
      projectId: opts.projectId ?? null,
      campaignId: opts.campaignId ?? null,
      label: opts.label ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  db.insert(jobEvents).values({ jobId: id, ts: now, kind: "status", dataJson: JSON.stringify({ status: "queued" }) }).run();
  return { id, existed: false };
}

export function requestCancel(db: DB, jobId: string): boolean {
  const row = db.select({ status: jobs.status }).from(jobs).where(eq(jobs.id, jobId)).get();
  if (!row) return false;
  if (row.status === "queued") {
    db.update(jobs).set({ status: "cancelled", cancelRequested: 1, finishedAt: Date.now(), updatedAt: Date.now() }).where(eq(jobs.id, jobId)).run();
    db.insert(jobEvents).values({ jobId, ts: Date.now(), kind: "status", dataJson: JSON.stringify({ status: "cancelled" }) }).run();
    return true;
  }
  if (row.status === "running") {
    db.update(jobs).set({ cancelRequested: 1, updatedAt: Date.now() }).where(eq(jobs.id, jobId)).run();
    return true;
  }
  return false;
}

export function retryJob(db: DB, jobId: string): boolean {
  const row = db.select({ status: jobs.status }).from(jobs).where(eq(jobs.id, jobId)).get();
  if (!row || (row.status !== "failed" && row.status !== "cancelled")) return false;
  db.update(jobs).set({ status: "queued", attempts: 0, error: null, cancelRequested: 0, runAfter: Date.now(), lockedBy: null, lockedAt: null, finishedAt: null, updatedAt: Date.now() }).where(eq(jobs.id, jobId)).run();
  db.insert(jobEvents).values({ jobId, ts: Date.now(), kind: "status", dataJson: JSON.stringify({ status: "queued", retried: true }) }).run();
  return true;
}

export function jobStatuses(db: DB, ids: string[]): Record<string, JobStatus> {
  if (ids.length === 0) return {};
  const rows = db.select({ id: jobs.id, status: jobs.status }).from(jobs).where(inArray(jobs.id, ids)).all();
  return Object.fromEntries(rows.map((r) => [r.id, r.status as JobStatus]));
}

export function countActiveJobs(db: DB, projectId?: string): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(jobs)
    .where(projectId ? and(inArray(jobs.status, ["queued", "running"]), eq(jobs.projectId, projectId)) : inArray(jobs.status, ["queued", "running"]))
    .get();
  return row?.n ?? 0;
}
