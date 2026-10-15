import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb, type DB } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { enqueue, requestCancel } from "@/queue/enqueue";
import { Worker, type HandlerRegistry } from "@/queue/worker";
import { jobs, jobEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PermanentError } from "@/queue/types";

let db: DB;
let sqlite: ReturnType<typeof createDb>["sqlite"];
let file: string;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(pred: () => boolean, ms = 8000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (pred()) return;
    await sleep(25);
  }
  throw new Error("timeout");
}

beforeEach(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "q-")), "q.sqlite");
  ({ db, sqlite } = createDb(file));
  runMigrations(db);
});
afterEach(() => sqlite.close());

describe("queue", () => {
  it("dedupes by idempotency key and runs a handler", async () => {
    const seen: string[] = [];
    const handlers: HandlerRegistry = { "demo.sleep": { lane: "local", run: async (ctx) => { seen.push(ctx.job.id); ctx.progress(50, "half"); return { ok: true }; } } };
    const a = enqueue(db, "demo.sleep", { n: 1 });
    const b = enqueue(db, "demo.sleep", { n: 1 });
    expect(b.existed).toBe(true);
    expect(a.id).toBe(b.id);
    const w = new Worker({ db, handlers, pollMs: 20 });
    w.start();
    await waitFor(() => db.select().from(jobs).where(eq(jobs.id, a.id)).get()?.status === "succeeded");
    await w.stop();
    expect(seen).toEqual([a.id]);
    const ev = db.select().from(jobEvents).where(eq(jobEvents.jobId, a.id)).all();
    expect(ev.some((e) => e.kind === "progress")).toBe(true);
  });

  it("retries transient failures and fails permanently on PermanentError", async () => {
    let n = 0;
    const handlers: HandlerRegistry = {
      "demo.sleep": { lane: "local", run: async (ctx) => { const p = ctx.payload as { mode: string }; n++; if (p.mode === "flaky" && n < 2) throw new Error("boom"); if (p.mode === "perm") throw new PermanentError("nope"); return {}; } },
    };
    const flaky = enqueue(db, "demo.sleep", { mode: "flaky" });
    const perm = enqueue(db, "demo.sleep", { mode: "perm" });
    // make retry immediate
    const w = new Worker({ db, handlers, pollMs: 20 });
    w.start();
    await waitFor(() => db.select().from(jobs).where(eq(jobs.id, perm.id)).get()?.status === "failed");
    // flaky is scheduled for retry in ~5s; shortcut by resetting run_after
    await waitFor(() => (db.select().from(jobs).where(eq(jobs.id, flaky.id)).get()?.attempts ?? 0) >= 1);
    db.update(jobs).set({ runAfter: Date.now() }).where(eq(jobs.id, flaky.id)).run();
    await waitFor(() => db.select().from(jobs).where(eq(jobs.id, flaky.id)).get()?.status === "succeeded");
    await w.stop();
    expect(db.select().from(jobs).where(eq(jobs.id, perm.id)).get()?.attempts).toBe(1);
  });

  it("cancels a running job and sweeps stale locks on restart", async () => {
    const handlers: HandlerRegistry = { "demo.sleep": { lane: "local", run: async (ctx) => { for (let i = 0; i < 100; i++) { if (ctx.isCancelled()) return {}; await sleep(20); } return {}; } } };
    const j = enqueue(db, "demo.sleep", { x: 1 });
    const w = new Worker({ db, handlers, pollMs: 20 });
    w.start();
    await waitFor(() => db.select().from(jobs).where(eq(jobs.id, j.id)).get()?.status === "running");
    requestCancel(db, j.id);
    await waitFor(() => db.select().from(jobs).where(eq(jobs.id, j.id)).get()?.status === "cancelled");
    await w.stop();
    // simulate crash: a running job with an old lock
    const stale = enqueue(db, "demo.sleep", { x: 2 });
    db.update(jobs).set({ status: "running", lockedAt: Date.now() - 120_000, lockedBy: "dead" }).where(eq(jobs.id, stale.id)).run();
    const w2 = new Worker({ db, handlers, pollMs: 20, staleMs: 60_000 });
    expect(w2.sweepStale()).toBe(1);
    expect(db.select().from(jobs).where(eq(jobs.id, stale.id)).get()?.status).toBe("queued");
  });

  it("claims atomically across two workers", async () => {
    const ran: Record<string, number> = {};
    const mk = () => new Worker({ db, handlers: { "demo.sleep": { lane: "local", run: async (ctx) => { ran[ctx.job.id] = (ran[ctx.job.id] ?? 0) + 1; await sleep(10); return {}; } } }, pollMs: 10 });
    const ids = Array.from({ length: 12 }, (_, i) => enqueue(db, "demo.sleep", { i }).id);
    const a = mk(), b = mk();
    a.start(); b.start();
    await waitFor(() => ids.every((id) => db.select().from(jobs).where(eq(jobs.id, id)).get()?.status === "succeeded"));
    await a.stop(); await b.stop();
    expect(Object.values(ran).every((n) => n === 1)).toBe(true);
    expect(Object.keys(ran).length).toBe(12);
  });
});
