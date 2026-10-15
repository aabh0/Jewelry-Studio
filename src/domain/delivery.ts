import { z } from "zod";

export interface ChannelSpec {
  id: string;
  label: string;
  aspect: string;
  width: number;
  height: number;
  kind: "image" | "video" | "both";
  maxVideoS?: number;
  safeZone?: { top: number; bottom: number; left: number; right: number }; // fractions
  notes?: string;
  format: "jpg" | "png" | "mp4";
  quality?: number;
  maxBytes?: number;
}

export const CHANNELS: ChannelSpec[] = [
  { id: "master", label: "Master (native)", aspect: "native", width: 0, height: 0, kind: "both", format: "png" },
  { id: "ig_feed_45", label: "Instagram feed 4:5", aspect: "4:5", width: 1080, height: 1350, kind: "both", maxVideoS: 60, format: "jpg", quality: 90 },
  { id: "ig_feed_11", label: "Instagram feed 1:1", aspect: "1:1", width: 1080, height: 1080, kind: "image", format: "jpg", quality: 90 },
  { id: "ig_reels", label: "Instagram Reels", aspect: "9:16", width: 1080, height: 1920, kind: "video", maxVideoS: 90, safeZone: { top: 0.14, bottom: 0.35, left: 0.06, right: 0.06 }, format: "mp4" },
  { id: "ig_story", label: "Instagram Story", aspect: "9:16", width: 1080, height: 1920, kind: "both", maxVideoS: 15, safeZone: { top: 0.14, bottom: 0.35, left: 0.06, right: 0.06 }, format: "jpg", quality: 90 },
  { id: "tiktok", label: "TikTok", aspect: "9:16", width: 1080, height: 1920, kind: "video", maxVideoS: 60, safeZone: { top: 150 / 1920, bottom: 400 / 1920, left: 0, right: 120 / 1080 }, format: "mp4" },
  { id: "yt_shorts", label: "YouTube Shorts", aspect: "9:16", width: 1080, height: 1920, kind: "video", maxVideoS: 180, safeZone: { top: 0.05, bottom: 0.15, left: 0, right: 0.1 }, format: "mp4" },
  { id: "pinterest_pin", label: "Pinterest Pin", aspect: "2:3", width: 1000, height: 1500, kind: "both", maxVideoS: 15, format: "jpg", quality: 90 },
  { id: "meta_ad_feed", label: "Meta ad (feed)", aspect: "4:5", width: 1080, height: 1350, kind: "both", maxVideoS: 60, format: "jpg", quality: 90 },
  { id: "meta_ad_story", label: "Meta ad (story/reels)", aspect: "9:16", width: 1080, height: 1920, kind: "both", maxVideoS: 60, safeZone: { top: 0.14, bottom: 0.35, left: 0.06, right: 0.06 }, format: "jpg", quality: 90 },
  { id: "web_hero", label: "Website hero 16:9", aspect: "16:9", width: 2560, height: 1440, kind: "both", maxVideoS: 20, format: "jpg", quality: 85 },
  { id: "web_hero_mobile", label: "Website hero mobile 4:5", aspect: "4:5", width: 1080, height: 1350, kind: "image", format: "jpg", quality: 85 },
  { id: "email_hero", label: "Email hero 2:1", aspect: "2:1", width: 1200, height: 600, kind: "image", format: "jpg", quality: 80, maxBytes: 200_000 },
  { id: "print_a4_300", label: "Print A4 300dpi", aspect: "1:1.414", width: 2480, height: 3508, kind: "image", format: "png", notes: "RGB master; CMYK conversion out of scope." },
];

export const zChannelId = z.enum(CHANNELS.map((c) => c.id) as [string, ...string[]]);
export type ChannelId = z.infer<typeof zChannelId>;

export function channelById(id: string): ChannelSpec | undefined {
  return CHANNELS.find((c) => c.id === id);
}

export const ASPECT_DIMS: Record<string, [number, number]> = {
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
  "5:4": [1350, 1080],
  "3:4": [1080, 1440],
  "4:3": [1440, 1080],
  "2:3": [1000, 1500],
  "3:2": [1500, 1000],
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
  "21:9": [2520, 1080],
};

export function aspectRatioValue(aspect: string): number {
  const [w, h] = aspect.split(":").map(Number);
  return w / h;
}

export function nearestAspect(target: string, supported: readonly string[]): string {
  if (supported.includes(target)) return target;
  const t = aspectRatioValue(target);
  let best = supported[0];
  let bestD = Infinity;
  for (const s of supported) {
    if (s === "auto") continue;
    const d = Math.abs(aspectRatioValue(s) - t);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}
