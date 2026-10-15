import { z } from "zod";

export const TRANSITIONS = ["cut", "fade", "dissolve", "wipeleft", "smoothleft", "circleopen", "fadeblack"] as const;

export const zTextOverlay = z.object({
  kind: z.literal("text").default("text"),
  copy: z.string(),
  font: z.enum(["Inter-Regular", "Inter-SemiBold", "InstrumentSerif-Regular"]).default("InstrumentSerif-Regular"),
  size_px: z.number().int().min(12).max(300).default(64),
  color: z.string().default("#F5F3EE"),
  position: z.enum(["top", "center", "bottom"]).default("bottom"),
  in_s: z.number().min(0).default(0.3),
  out_s: z.number().min(0).default(2.5),
  bg: z.object({ color: z.string().default("#000000"), opacity: z.number().min(0).max(1).default(0.35) }).optional(),
});

export const zTimelineClip = z.object({
  asset_id: z.string(),
  in_s: z.number().min(0).default(0),
  out_s: z.number().min(0).optional(),
  fit: z.enum(["cover", "contain"]).default("cover"),
  transition_in: z.object({ type: z.enum(TRANSITIONS), duration_s: z.number().min(0.1).max(2).default(0.5) }).optional(),
  overlays: z.array(zTextOverlay).default([]),
  speed: z.number().min(0.25).max(4).default(1),
  focal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
});

export const zTimeline = z.object({
  version: z.literal(1).default(1),
  output: z.object({ width: z.number().int(), height: z.number().int(), fps: z.number().int().default(30), channel_id: z.string().optional() }),
  clips: z.array(zTimelineClip).default([]),
  end_card: z.object({ duration_s: z.number().default(1.5), bg_color: z.string().default("#0C0C0D"), logo_asset_id: z.string().optional(), copy: z.string().optional(), fade_in_s: z.number().default(0.3) }).optional(),
  music: z.object({ asset_id: z.string(), offset_s: z.number().default(0), volume: z.number().min(0).max(2).default(0.8), fade_in_s: z.number().default(1), fade_out_s: z.number().default(2), mode: z.enum(["replace", "duck", "mix"]).default("replace") }).optional(),
  keep_clip_audio: z.boolean().default(false),
});
export type Timeline = z.infer<typeof zTimeline>;
export type TimelineClip = z.infer<typeof zTimelineClip>;
export type TextOverlay = z.infer<typeof zTextOverlay>;
