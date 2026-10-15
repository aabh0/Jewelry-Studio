import { gt, and, eq, desc } from "drizzle-orm";
import type { DB } from "@/db/client";
import { jobEvents, jobs } from "@/db/schema";

export interface EventRow {
  id: number;
  job_id: string;
  ts: number;
  kind: string;
  data: unknown;
  project_id: string | null;
  job_type: string;
  job_status: string;
}

export function eventsSince(db: DB, sinceId: number, limit = 200, projectId?: string): EventRow[] {
  const rows = db
    .select({ id: jobEvents.id, jobId: jobEvents.jobId, ts: jobEvents.ts, kind: jobEvents.kind, dataJson: jobEvents.dataJson, projectId: jobs.projectId, jobType: jobs.type, jobStatus: jobs.status })
    .from(jobEvents)
    .innerJoin(jobs, eq(jobs.id, jobEvents.jobId))
    .where(projectId ? and(gt(jobEvents.id, sinceId), eq(jobs.projectId, projectId)) : gt(jobEvents.id, sinceId))
    .orderBy(jobEvents.id)
    .limit(limit)
    .all();
  return rows.map((r) => ({ id: r.id, job_id: r.jobId, ts: r.ts, kind: r.kind, data: JSON.parse(r.dataJson), project_id: r.projectId, job_type: r.jobType, job_status: r.jobStatus }));
}

export function latestEventId(db: DB): number {
  const row = db.select({ id: jobEvents.id }).from(jobEvents).orderBy(desc(jobEvents.id)).limit(1).get();
  return row?.id ?? 0;
}
