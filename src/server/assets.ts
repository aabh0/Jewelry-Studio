import { eq, and, desc, inArray, isNull, sql } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs/promises";
import type { DB } from "@/db/client";
import { assets, assetTags } from "@/db/schema";
import { newId } from "@/lib/ids";
import { dirs, absPath, relPath, sha256File, mimeFor, safeFilename, moveFileAtomic, extForMime } from "@/lib/files";
import { normalizeUpload, imageMeta, thumbnail } from "@/providers/local/sharp";
import { probe } from "@/providers/local/ffprobe";
import { makeThumbnail } from "@/providers/local/ffmpeg";
import { notFound } from "./errors";

export type AssetRow = typeof assets.$inferSelect;

export function kindForMime(mime: string): "image" | "video" | "audio" | "font" | "mask" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("font/")) return "font";
  return "image";
}

export interface RegisterOptions {
  projectId: string | null;
  absFile: string; // already inside DATA_DIR
  role: string;
  kind?: "image" | "video" | "audio" | "mask" | "font";
  originalName?: string;
  sourceJobId?: string;
  parentAssetId?: string;
  version?: number;
  providerUrl?: string;
  meta?: Record<string, unknown>;
  tags?: string[];
}

/** Register a file that is already in its final place under DATA_DIR. */
export async function registerAsset(db: DB, o: RegisterOptions): Promise<AssetRow> {
  const mime = mimeFor(o.absFile);
  const kind = o.kind ?? kindForMime(mime);
  const stat = await fs.stat(o.absFile);
  const sha = await sha256File(o.absFile);
  let width: number | null = null, height: number | null = null, durationMs: number | null = null, fps: number | null = null, hasAudio: number | null = null;
  if (kind === "image" || kind === "mask") {
    try { const m = await imageMeta(o.absFile); width = m.width; height = m.height; } catch { /* ignore */ }
  } else if (kind === "video" || kind === "audio") {
    try { const p = await probe(o.absFile); width = p.width; height = p.height; durationMs = p.durationMs; fps = p.fps; hasAudio = p.hasAudio ? 1 : 0; } catch { /* ignore */ }
  }
  const id = newId();
  const row: typeof assets.$inferInsert = {
    id, projectId: o.projectId, kind, role: o.role, pathRel: relPath(o.absFile), mime, bytes: stat.size, sha256: sha, width, height, durationMs, fps, hasAudio,
    originalName: o.originalName ?? null, sourceJobId: o.sourceJobId ?? null, parentAssetId: o.parentAssetId ?? null, version: o.version ?? 1, providerUrl: o.providerUrl ?? null,
    metaJson: o.meta ? JSON.stringify(o.meta) : null, createdAt: Date.now(),
  };
  db.insert(assets).values(row).run();
  for (const t of o.tags ?? []) db.insert(assetTags).values({ assetId: id, tag: t }).onConflictDoNothing().run();
  return db.select().from(assets).where(eq(assets.id, id)).get()!;
}

/** Ingest an uploaded temp file: normalize images (EXIF strip, HEIC→JPEG), move into project refs, register. */
export async function ingestUpload(db: DB, projectId: string, tmpAbs: string, originalName: string, role = "upload"): Promise<AssetRow> {
  const mime = mimeFor(originalName) === "application/octet-stream" ? mimeFor(tmpAbs) : mimeFor(originalName);
  const kind = kindForMime(mime);
  const id = newId();
  const base = path.join(dirs.project(projectId), "refs", id);
  await fs.mkdir(path.dirname(base), { recursive: true });
  let finalAbs: string;
  if (kind === "image") {
    const out = await normalizeUpload(tmpAbs, base);
    finalAbs = out.file;
    await fs.unlink(tmpAbs).catch(() => {});
  } else {
    const ext = path.extname(originalName).toLowerCase() || extForMime(mime);
    finalAbs = base + ext;
    await moveFileAtomic(tmpAbs, finalAbs);
  }
  const row = await registerAsset(db, { projectId, absFile: finalAbs, role, kind, originalName: safeFilename(originalName) });
  return row;
}

export function getAsset(db: DB, id: string): AssetRow {
  const a = db.select().from(assets).where(eq(assets.id, id)).get();
  if (!a) throw notFound("Asset");
  return a;
}

export function getAssets(db: DB, ids: string[]): AssetRow[] {
  if (ids.length === 0) return [];
  const rows = db.select().from(assets).where(inArray(assets.id, ids)).all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((i) => byId.get(i)).filter((r): r is AssetRow => !!r);
}

export function assetAbs(a: AssetRow): string {
  return absPath(a.pathRel.split("/").join(path.sep));
}

export interface AssetFilter {
  projectId?: string;
  role?: string[];
  kind?: string[];
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function listAssets(db: DB, f: AssetFilter): { items: AssetRow[]; total: number } {
  const conds = [isNull(assets.deletedAt)];
  if (f.projectId) conds.push(eq(assets.projectId, f.projectId));
  if (f.role?.length) conds.push(inArray(assets.role, f.role));
  if (f.kind?.length) conds.push(inArray(assets.kind, f.kind));
  if (f.search) conds.push(sql`(${assets.originalName} like ${"%" + f.search + "%"} or ${assets.note} like ${"%" + f.search + "%"})`);
  if (f.tag) conds.push(sql`${assets.id} in (select asset_id from asset_tags where tag = ${f.tag})`);
  const where = and(...conds);
  const total = db.select({ n: sql<number>`count(*)` }).from(assets).where(where).get()?.n ?? 0;
  const items = db.select().from(assets).where(where).orderBy(desc(assets.createdAt)).limit(f.limit ?? 100).offset(f.offset ?? 0).all();
  return { items, total };
}

export function assetTagsFor(db: DB, assetId: string): string[] {
  return db.select({ tag: assetTags.tag }).from(assetTags).where(eq(assetTags.assetId, assetId)).all().map((r) => r.tag);
}

export function setAssetTags(db: DB, assetId: string, tags: string[]): void {
  db.delete(assetTags).where(eq(assetTags.assetId, assetId)).run();
  for (const t of tags) db.insert(assetTags).values({ assetId, tag: t }).run();
}

export function updateAsset(db: DB, id: string, patch: { note?: string | null; meta?: Record<string, unknown> }): AssetRow {
  const cur = getAsset(db, id);
  const meta = patch.meta ? { ...(cur.metaJson ? JSON.parse(cur.metaJson) : {}), ...patch.meta } : undefined;
  db.update(assets).set({ ...(patch.note !== undefined ? { note: patch.note } : {}), ...(meta ? { metaJson: JSON.stringify(meta) } : {}) }).where(eq(assets.id, id)).run();
  return getAsset(db, id);
}

/** Soft delete: move the file to trash and mark deletedAt. */
export async function trashAsset(db: DB, id: string): Promise<void> {
  const a = getAsset(db, id);
  const src = assetAbs(a);
  const dest = path.join(dirs.trash(), a.projectId ?? "global", path.basename(src));
  await moveFileAtomic(src, dest).catch(() => {});
  db.update(assets).set({ deletedAt: Date.now() }).where(eq(assets.id, id)).run();
}

export async function ensureThumb(db: DB, assetId: string, w: number): Promise<string> {
  const a = getAsset(db, assetId);
  const dest = path.join(dirs.thumbs(), `${a.id}-${w}.webp`);
  try {
    await fs.access(dest);
    return dest;
  } catch {
    /* generate */
  }
  const src = assetAbs(a);
  if (a.kind === "video") {
    const frame = dest.replace(/\.webp$/, ".jpg");
    await makeThumbnail(src, frame, 0.5, Math.max(w, 640));
    await thumbnail(frame, dest, w);
    await fs.unlink(frame).catch(() => {});
  } else if (a.kind === "audio") {
    throw notFound("Thumbnail");
  } else {
    await thumbnail(src, dest, w);
  }
  return dest;
}

/** Allocate a destination path inside a project for generated output. */
export async function allocOutputPath(projectId: string, sub: string, name: string): Promise<string> {
  const dir = path.join(dirs.project(projectId), sub);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, name);
}

export function lineage(db: DB, assetId: string): AssetRow[] {
  const out: AssetRow[] = [];
  let cur: AssetRow | undefined = db.select().from(assets).where(eq(assets.id, assetId)).get();
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    out.push(cur);
    seen.add(cur.id);
    cur = cur.parentAssetId ? db.select().from(assets).where(eq(assets.id, cur.parentAssetId)).get() : undefined;
  }
  return out;
}
