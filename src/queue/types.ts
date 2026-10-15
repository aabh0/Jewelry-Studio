import type { DB } from "@/db/client";
import type { Logger } from "@/lib/log";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type JobType =
  | "asset.ingest"
  | "product.clean_plate"
  | "product.sheet"
  | "talent.sheet"
  | "talent.soul_train"
  | "director.shot_list"
  | "director.storyboard"
  | "director.talent_expand"
  | "director.critique"
  | "director.brief_parse"
  | "gen.image"
  | "gen.video"
  | "qa.image"
  | "qa.video"
  | "edit.run"
  | "ffmpeg.render"
  | "export.run"
  | "fanout.await"
  | "provider.probe"
  | "backup.snapshot"
  | "project.export_bundle"
  | "project.import_bundle"
  | "demo.sleep";

export type Lane = "provider" | "ffmpeg" | "claude" | "local";

export interface JobRow {
  id: string;
  type: JobType;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  parentId: string | null;
  projectId: string | null;
  campaignId: string | null;
  label: string | null;
  result: unknown;
}

export interface JobEventData {
  pct?: number;
  message?: string;
  line?: string;
  asset_id?: string;
  estimate_usd?: number;
  actual_usd?: number;
  credits?: number;
  status?: JobStatus;
  [k: string]: unknown;
}

export interface HandlerContext<P = unknown> {
  job: JobRow;
  payload: P;
  db: DB;
  log: Logger;
  emit: (kind: "progress" | "log" | "status" | "artifact" | "cost", data: JobEventData) => void;
  progress: (pct: number, message?: string) => void;
  touch: () => void;
  isCancelled: () => boolean;
  /** Persist partial result (e.g. provider request id) so a crash can resume instead of re-submitting. */
  checkpoint: (partial: Record<string, unknown>) => void;
  enqueueChild: (type: JobType, payload: unknown, opts?: { label?: string; priority?: number }) => string;
}

export type Handler<P = unknown, R = unknown> = (ctx: HandlerContext<P>) => Promise<R>;

export interface HandlerSpec<P = unknown, R = unknown> {
  lane: Lane;
  maxAttempts?: number;
  run: Handler<P, R>;
}

export class PermanentError extends Error {
  readonly permanent = true;
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "PermanentError";
  }
}

export class CancelledError extends Error {
  readonly cancelled = true;
  constructor() {
    super("cancelled");
    this.name = "CancelledError";
  }
}

export function isPermanent(err: unknown): err is PermanentError {
  return !!err && typeof err === "object" && (err as PermanentError).permanent === true;
}
