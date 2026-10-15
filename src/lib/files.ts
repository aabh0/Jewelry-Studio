import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "@/env";

export const DATA_DIR = env.DATA_DIR;

export const dirs = {
  root: () => DATA_DIR,
  projects: () => path.join(DATA_DIR, "projects"),
  project: (projectId: string) => path.join(DATA_DIR, "projects", projectId),
  cache: () => path.join(DATA_DIR, "cache"),
  thumbs: () => path.join(DATA_DIR, "cache", "thumbs"),
  tmp: () => path.join(DATA_DIR, "tmp"),
  logs: () => path.join(DATA_DIR, "logs"),
  backups: () => path.join(DATA_DIR, "backups"),
  trash: () => path.join(DATA_DIR, "trash"),
};

export function ensureDataDirs(): void {
  for (const d of [dirs.root(), dirs.projects(), dirs.cache(), dirs.thumbs(), dirs.tmp(), dirs.logs(), path.join(dirs.logs(), "ffmpeg"), path.join(dirs.logs(), "cli"), dirs.backups(), dirs.trash()]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

/** Resolve a DATA_DIR-relative path to absolute, rejecting traversal. */
export function absPath(rel: string): string {
  const abs = path.resolve(DATA_DIR, rel);
  const root = path.resolve(DATA_DIR) + path.sep;
  if (abs !== path.resolve(DATA_DIR) && !abs.startsWith(root)) {
    throw new Error(`Path escapes DATA_DIR: ${rel}`);
  }
  return abs;
}

export function relPath(abs: string): string {
  const rel = path.relative(DATA_DIR, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Path outside DATA_DIR: ${abs}`);
  return rel.split(path.sep).join("/");
}

export function toOsPath(rel: string): string {
  return absPath(rel.split("/").join(path.sep));
}

export async function sha256File(abs: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(abs)
      .on("data", (c) => h.update(c))
      .on("error", reject)
      .on("end", () => resolve(h.digest("hex")));
  });
}

export function sha256Buffer(buf: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** Atomic write: tmp file in the same directory then rename. */
export async function writeFileAtomic(abs: string, data: Buffer | Uint8Array | string): Promise<void> {
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, abs);
}

/** Move a file into place atomically when on the same volume; falls back to copy+unlink. */
export async function moveFileAtomic(src: string, dest: string): Promise<void> {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fsp.rename(src, dest);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EXDEV") {
      await fsp.copyFile(src, dest);
      await fsp.unlink(src);
    } else {
      throw err;
    }
  }
}

export function tmpFile(ext: string): string {
  fs.mkdirSync(dirs.tmp(), { recursive: true });
  return path.join(dirs.tmp(), `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext.startsWith(".") ? ext : "." + ext}`);
}

export const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".json": "application/json",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

export function mimeFor(file: string): string {
  return MIME_BY_EXT[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

export function extForMime(mime: string): string {
  const entry = Object.entries(MIME_BY_EXT).find(([, m]) => m === mime);
  return entry ? entry[0] : ".bin";
}

export async function fileExists(abs: string): Promise<boolean> {
  try {
    await fsp.access(abs);
    return true;
  } catch {
    return false;
  }
}

export function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120) || "file";
}
