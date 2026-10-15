import { and, eq, lte, sql, inArray, lt } from "drizzle-orm";
import pLimit from "p-limit";
import os from "node:os";
import type { DB } from "@/db/client";
import { jobs, jobEvents } from "@/db/schema";
import { log as baseLog } from "@/lib/log";
import { env } from "@/env";
import type { HandlerSpec, HandlerContext, JobRow, JobType, Lane, JobEventData } from "./types";
import { isPermanent, CancelledError } from "./types";
import { enqueue } from "./enqueue";

export type HandlerRegistry = Partial<Record<JobType, HandlerSpec<never, unknown>>>;

export interface WorkerOptions {
  db: DB;
  handlers: HandlerRegistry;
  workerId?: string;
  pollMs?: number;
  heartbeatMs?: number;
  staleMs?: number;
  concurrency?: Partial<Record<Lane, number>>;
}

export class Worker {
  private db: DB;
  private handlers: HandlerRegistry;
  readonly workerId: string;
  private pollMs: number;
  private heartbeatMs: number;
  private staleMs: number;
  private limits: Record<Lane, ReturnType<typeof pLimit>>;
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private inflight = new Set<Promise<void>>();
  private wakeResolve: (() => void) | null = null;

  constructor(opts: WorkerOptions) {
    this.db = opts.db;
    this.handlers = opts.handlers;
    this.workerId = opts.workerId ?? `${os.hostname()}-${process.pid}`;
    this.pollMs = opts.pollMs ?? 500;
    this.heartbeatMs = opts.heartbeatMs ?? 10_000;
    this.staleMs = opts.staleMs ?? 60_000;
    const c = opts.concurrency ?? {};
    this.limits = {
      provider: pLimit(c.provider ?? env.WORKER_CONCURRENCY_PROVIDER),
      ffmpeg: pLimit(c.ffmpeg ?? env.WORKER_CONCURRENCY_FFMPEG),
      claude: pLimit(c.claude ?? env.WORKER_CONCURRENCY_CLAUDE),
      local: pLimit(c.local ?? 2),
    };
  }

  /** Reset jobs abandoned by a crashed worker. Jobs with a provider request id checkpoint resume by polling.
   *  `all` requeues every running job regardless of age: used at boot, when this single worker is the only one that could own them. */
  sweepStale(all = false): number {
    const cutoff = Date.now() - this.staleMs;
    const stale = this.db.select({ id: jobs.id }).from(jobs).where(all ? eq(jobs.status, "running") : and(eq(jobs.status, "running"), lt(jobs.lockedAt, cutoff))).all();
    for (const s of stale) {
      this.db.update(jobs).set({ status: "queued", lockedBy: null, lockedAt: null, runAfter: Date.now(), updatedAt: Date.now() }).where(eq(jobs.id, s.id)).run();
      this.event(s.id, "log", { line: "requeued after worker restart" });
    }
    return stale.length;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.sweepStale();
    const loop = async () => {
      while (this.running) {
        const claimed = this.claim();
        if (claimed.length === 0) {
          await new Promise<void>((r) => {
            this.wakeResolve = r;
            this.timer = setTimeout(r, this.pollMs);
          });
          this.wakeResolve = null;
        }
      }
    };
    void loop();
  }

  wake(): void {
    if (this.timer) clearTimeout(this.timer);
    this.wakeResolve?.();
  }

  async stop(): Promise<void> {
    this.running = false;
    this.wake();
    await Promise.allSettled(Array.from(this.inflight));
  }

  /** Atomically claim queued jobs whose lane has capacity. */
  private claim(): JobRow[] {
    const claimed: JobRow[] = [];
    const now = Date.now();
    const candidates = this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.status, "queued"), lte(jobs.runAfter, now)))
      .orderBy(sql`${jobs.priority} desc`, jobs.createdAt)
      .limit(20)
      .all();
    for (const row of candidates) {
      const spec = this.handlers[row.type as JobType];
      if (!spec) {
        this.fail(row.id, `No handler registered for job type ${row.type}`, true);
        continue;
      }
      const limit = this.limits[spec.lane];
      if (limit.activeCount + limit.pendingCount >= limit.concurrency) continue;
      const res = this.db
        .update(jobs)
        .set({ status: "running", lockedBy: this.workerId, lockedAt: now, attempts: sql`${jobs.attempts} + 1`, updatedAt: now })
        .where(and(eq(jobs.id, row.id), eq(jobs.status, "queued")))
        .run();
      if (res.changes !== 1) continue;
      const jr: JobRow = {
        id: row.id,
        type: row.type as JobType,
        payload: JSON.parse(row.payloadJson),
        attempts: row.attempts + 1,
        maxAttempts: row.maxAttempts,
        parentId: row.parentId,
        projectId: row.projectId,
        campaignId: row.campaignId,
        label: row.label,
        result: row.resultJson ? JSON.parse(row.resultJson) : undefined,
      };
      claimed.push(jr);
      const p = limit(() => this.execute(jr, spec)).finally(() => {
        this.inflight.delete(p);
        this.wake();
      });
      this.inflight.add(p);
    }
    return claimed;
  }

  private event(jobId: string, kind: "progress" | "log" | "status" | "artifact" | "cost", data: JobEventData): void {
    this.db.insert(jobEvents).values({ jobId, ts: Date.now(), kind, dataJson: JSON.stringify(data) }).run();
    if (kind === "progress") {
      this.db.update(jobs).set({ progressPct: data.pct ?? null, progressMessage: data.message ?? null, updatedAt: Date.now() }).where(eq(jobs.id, jobId)).run();
    }
  }

  private fail(jobId: string, message: string, permanent: boolean): void {
    const now = Date.now();
    const row = this.db.select({ attempts: jobs.attempts, maxAttempts: jobs.maxAttempts }).from(jobs).where(eq(jobs.id, jobId)).get();
    if (!permanent && row && row.attempts < row.maxAttempts) {
      const delay = Math.min(2 ** row.attempts * 5000 + Math.random() * 1000, 5 * 60_000);
      this.db.update(jobs).set({ status: "queued", runAfter: now + delay, lockedBy: null, lockedAt: null, error: message, updatedAt: now }).where(eq(jobs.id, jobId)).run();
      this.event(jobId, "status", { status: "queued", message: `retry in ${Math.round(delay / 1000)}s: ${message}` });
      return;
    }
    this.db.update(jobs).set({ status: "failed", error: message, lockedBy: null, lockedAt: null, finishedAt: now, updatedAt: now }).where(eq(jobs.id, jobId)).run();
    this.event(jobId, "status", { status: "failed", message });
  }

  private async execute(job: JobRow, spec: HandlerSpec<never, unknown>): Promise<void> {
    const jlog = baseLog.child({ job: job.id, type: job.type });
    this.event(job.id, "status", { status: "running", attempt: job.attempts });
    let hb: NodeJS.Timeout | null = null;
    const touch = () => this.db.update(jobs).set({ lockedAt: Date.now() }).where(eq(jobs.id, job.id)).run();
    hb = setInterval(touch, this.heartbeatMs);
    const ctx: HandlerContext<never> = {
      job,
      payload: job.payload as never,
      db: this.db,
      log: jlog,
      emit: (kind, data) => this.event(job.id, kind, data),
      progress: (pct, message) => this.event(job.id, "progress", { pct, message }),
      touch,
      isCancelled: () => {
        const r = this.db.select({ c: jobs.cancelRequested }).from(jobs).where(eq(jobs.id, job.id)).get();
        return !!r && r.c === 1;
      },
      checkpoint: (partial) => {
        const cur = this.db.select({ r: jobs.resultJson }).from(jobs).where(eq(jobs.id, job.id)).get();
        const merged = { ...(cur?.r ? JSON.parse(cur.r) : {}), ...partial };
        job.result = merged;
        this.db.update(jobs).set({ resultJson: JSON.stringify(merged), updatedAt: Date.now() }).where(eq(jobs.id, job.id)).run();
      },
      enqueueChild: (type, payload, opts) =>
        enqueue(this.db, type, payload, { parentId: job.id, projectId: job.projectId ?? undefined, campaignId: job.campaignId ?? undefined, label: opts?.label, priority: opts?.priority, idempotencyKey: null }).id,
    };
    try {
      const result = await spec.run(ctx);
      if (ctx.isCancelled()) throw new CancelledError();
      const now = Date.now();
      const cur = this.db.select({ r: jobs.resultJson }).from(jobs).where(eq(jobs.id, job.id)).get();
      const merged = { ...(cur?.r ? JSON.parse(cur.r) : {}), ...((result as object) ?? {}) };
      this.db.update(jobs).set({ status: "succeeded", resultJson: JSON.stringify(merged), lockedBy: null, lockedAt: null, finishedAt: now, updatedAt: now, progressPct: 100 }).where(eq(jobs.id, job.id)).run();
      this.event(job.id, "status", { status: "succeeded" });
    } catch (err) {
      const e = err as Error & { cancelled?: boolean };
      if (e?.cancelled || ctx.isCancelled()) {
        const now = Date.now();
        this.db.update(jobs).set({ status: "cancelled", lockedBy: null, lockedAt: null, finishedAt: now, updatedAt: now }).where(eq(jobs.id, job.id)).run();
        this.event(job.id, "status", { status: "cancelled" });
      } else {
        jlog.error({ err: e?.message, stack: e?.stack }, "job failed");
        this.fail(job.id, e?.message ?? String(err), isPermanent(err) || (spec.maxAttempts ?? 3) <= 1);
      }
    } finally {
      if (hb) clearInterval(hb);
    }
  }
}

export function finishedStatus(db: DB, ids: string[]): { done: boolean; failed: string[]; succeeded: string[] } {
  if (ids.length === 0) return { done: true, failed: [], succeeded: [] };
  const rows = db.select({ id: jobs.id, status: jobs.status }).from(jobs).where(inArray(jobs.id, ids)).all();
  const failed = rows.filter((r) => r.status === "failed" || r.status === "cancelled").map((r) => r.id);
  const succeeded = rows.filter((r) => r.status === "succeeded").map((r) => r.id);
  return { done: failed.length + succeeded.length === ids.length, failed, succeeded };
}
