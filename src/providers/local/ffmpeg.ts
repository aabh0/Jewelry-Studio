import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/env";
import { dirs } from "@/lib/files";

export function ffmpegPath(): string {
  if (env.FFMPEG_PATH && fs.existsSync(env.FFMPEG_PATH)) return env.FFMPEG_PATH;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require("ffmpeg-static") as string | null;
    if (p && fs.existsSync(p)) return p;
  } catch {
    /* fall through */
  }
  return "ffmpeg";
}

export interface RunFfmpegOptions {
  onProgress?: (seconds: number) => void;
  logName?: string;
  signal?: AbortSignal;
  cwd?: string;
  timeoutMs?: number;
}

/** Run ffmpeg with progress parsing. Resolves on exit code 0; rejects with the stderr tail otherwise. */
export function runFfmpeg(args: string[], opts: RunFfmpegOptions = {}): Promise<void> {
  const bin = ffmpegPath();
  const full = ["-hide_banner", "-nostats", "-loglevel", "error", "-progress", "pipe:1", "-y", ...args];
  const logDir = path.join(dirs.logs(), "ffmpeg");
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = opts.logName ? path.join(logDir, `${opts.logName}.log`) : null;
  const logStream = logFile ? fs.createWriteStream(logFile, { flags: "a" }) : null;
  logStream?.write(`\n$ ${bin} ${full.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(bin, full, { cwd: opts.cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stderrTail = "";
    let stdoutBuf = "";
    const timer = opts.timeoutMs ? setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs) : null;
    const onAbort = () => child.kill("SIGKILL");
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (d: Buffer) => {
      stdoutBuf += d.toString();
      let idx: number;
      while ((idx = stdoutBuf.indexOf("\n")) >= 0) {
        const line = stdoutBuf.slice(0, idx).trim();
        stdoutBuf = stdoutBuf.slice(idx + 1);
        if (line.startsWith("out_time_us=")) {
          const us = parseInt(line.slice("out_time_us=".length), 10);
          if (!Number.isNaN(us) && us >= 0) opts.onProgress?.(us / 1_000_000);
        } else if (line.startsWith("out_time_ms=")) {
          const ms = parseInt(line.slice("out_time_ms=".length), 10);
          if (!Number.isNaN(ms) && ms >= 0) opts.onProgress?.(ms / 1_000_000);
        }
      }
    });
    child.stderr.on("data", (d: Buffer) => {
      const s = d.toString();
      logStream?.write(s);
      stderrTail = (stderrTail + s).slice(-4000);
    });
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      logStream?.end();
      reject(err);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      logStream?.end();
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderrTail.trim().split("\n").slice(-6).join(" | ")}`));
    });
  });
}

/** Escape a path for use inside an ffmpeg filter option (drawtext fontfile, etc.). */
export function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export function escapeDrawtext(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/%/g, "%%").replace(/,/g, "\\,");
}

export const ENCODE_H264 = ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
export const ENCODE_H264_FAST = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
export const ENCODE_AAC = ["-c:a", "aac", "-b:a", "192k"];

export function normalizeFilter(w: number, h: number, fit: "cover" | "contain", fps = 30, focal?: { x: number; y: number }): string {
  if (fit === "cover") {
    const fx = focal?.x ?? 0.5;
    const fy = focal?.y ?? 0.5;
    return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-ow)*${fx.toFixed(3)}:(ih-oh)*${fy.toFixed(3)},setsar=1,fps=${fps},format=yuv420p`;
  }
  return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${fps},format=yuv420p`;
}

export async function extractFrame(input: string, output: string, which: "first" | "last" | number): Promise<void> {
  if (which === "first") await runFfmpeg(["-i", input, "-frames:v", "1", "-update", "1", output]);
  else if (which === "last") await runFfmpeg(["-sseof", "-0.15", "-i", input, "-update", "1", "-frames:v", "1", output]);
  else await runFfmpeg(["-ss", String(which), "-i", input, "-frames:v", "1", "-update", "1", output]);
}

export async function makeThumbnail(input: string, output: string, atSeconds = 0.5, width = 640): Promise<void> {
  await runFfmpeg(["-ss", String(atSeconds), "-i", input, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "3", "-update", "1", output]);
}

export async function contactSheet(input: string, output: string, cols = 3, rows = 2, width = 480): Promise<void> {
  // pick frames evenly: use thumbnail-ish sampling via select on fps
  await runFfmpeg(["-i", input, "-vf", `fps=1,scale=${width}:-2,tile=${cols}x${rows}`, "-frames:v", "1", "-update", "1", output]);
}

export async function waveformPng(input: string, output: string, w = 1200, h = 120): Promise<void> {
  await runFfmpeg(["-i", input, "-filter_complex", `showwavespic=s=${w}x${h}:colors=#D4B27A`, "-frames:v", "1", "-update", "1", output]);
}
