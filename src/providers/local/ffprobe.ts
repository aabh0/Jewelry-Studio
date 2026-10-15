import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import { env } from "@/env";

const execFileP = promisify(execFile);

export function ffprobePath(): string {
  if (env.FFPROBE_PATH && fs.existsSync(env.FFPROBE_PATH)) return env.FFPROBE_PATH;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require("@derhuerst/ffprobe-static") as string;
    if (p && fs.existsSync(p)) return p;
  } catch {
    /* fall through */
  }
  return "ffprobe";
}

export interface ProbeResult {
  durationMs: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  hasAudio: boolean;
  nbFrames: number | null;
  codec: string | null;
  raw: unknown;
}

export async function probe(file: string): Promise<ProbeResult> {
  const { stdout } = await execFileP(ffprobePath(), ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { maxBuffer: 10 * 1024 * 1024 });
  const json = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ codec_type?: string; width?: number; height?: number; r_frame_rate?: string; nb_frames?: string; codec_name?: string; duration?: string }> };
  const v = json.streams?.find((s) => s.codec_type === "video");
  const a = json.streams?.find((s) => s.codec_type === "audio");
  let fps: number | null = null;
  if (v?.r_frame_rate) {
    const [n, d] = v.r_frame_rate.split("/").map(Number);
    if (n && d) fps = +(n / d).toFixed(3);
  }
  const dur = json.format?.duration ?? v?.duration;
  return {
    durationMs: dur ? Math.round(parseFloat(dur) * 1000) : null,
    width: v?.width ?? null,
    height: v?.height ?? null,
    fps,
    hasAudio: !!a,
    nbFrames: v?.nb_frames ? parseInt(v.nb_frames, 10) : null,
    codec: v?.codec_name ?? null,
    raw: json,
  };
}
