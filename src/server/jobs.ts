import { eq, desc, inArray, and } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobs, jobEvents } from "@/db/schema";
import { notFound } from "./errors";

export function listJobs(db: DB, opts: { status?: string[]; projectId?: string; limit?: number }) {
  const conds = [];
  if (opts.status?.length) conds.push(inArray(jobs.status, opts.status));
  if (opts.projectId) conds.push(eq(jobs.projectId, opts.projectId));
  return db.select().from(jobs).where(conds.length ? and(...conds) : undefined).orderBy(desc(jobs.createdAt)).limit(opts.limit ?? 100).all().map(slim);
}

function slim(j: typeof jobs.$inferSelect) {
  return { ...j, payload: JSON.parse(j.payloadJson), result: j.resultJson ? JSON.parse(j.resultJson) : null, payloadJson: undefined, resultJson: undefined };
}

export function getJob(db: DB, id: string) {
  const j = db.select().from(jobs).where(eq(jobs.id, id)).get();
  if (!j) throw notFound("Job");
  const events = db.select().from(jobEvents).where(eq(jobEvents.jobId, id)).orderBy(jobEvents.id).limit(500).all().map((e) => ({ ...e, data: JSON.parse(e.dataJson) }));
  const children = db.select().from(jobs).where(eq(jobs.parentId, id)).all().map(slim);
  return { ...slim(j), events, children };
}
