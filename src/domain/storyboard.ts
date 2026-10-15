import { z } from "zod";
import { zShotFormat, zBodyCrop, zAspect, zQaFocus, zOccasion } from "./taxonomy";
import { zLightingSpec, zCameraSpec, zSceneSpec } from "./lighting";
import { zChannelId } from "./delivery";

export const zCampaignBrief = z.object({
  goal: z.string().default(""),
  channels: z.array(zChannelId).default(["ig_feed_45"]),
  tone: z.array(z.string()).default([]),
  must_include: z.array(z.string()).default([]),
  must_avoid: z.array(z.string()).default([]),
  references_text: z.string().optional(),
  occasion: zOccasion.optional(),
  locale: z.string().optional(),
  deliverables: z.object({
    stills: z.number().int().min(0).max(40).optional(),
    videos: z.array(z.object({ count: z.number().int().min(1).max(10), duration_s: z.union([z.literal(6), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]) })).optional(),
  }).default({}),
  budget_usd: z.number().positive().optional(),
});
export type CampaignBrief = z.infer<typeof zCampaignBrief>;

export const zCampaignSettings = z.object({
  variants_per_shot: z.number().int().min(1).max(8).default(4),
  keyframe_variants: z.number().int().min(1).max(6).default(3),
  clip_variants: z.number().int().min(1).max(4).default(2),
  default_aspect: zAspect.default("4:5"),
  resolution: z.enum(["1k", "2k", "4k"]).default("2k"),
  lighting_preset: z.string().default("clean_studio"),
  image_capability_override: z.string().optional(),
  video_capability_override: z.string().optional(),
  budget_cap_usd: z.number().positive().optional(),
});
export type CampaignSettings = z.infer<typeof zCampaignSettings>;

export const zShotSpec = z.object({
  format: zShotFormat.default("hero_still_life"),
  crop: zBodyCrop.optional(),
  purpose: z.string().default(""),
  product_ids: z.array(z.string()).default([]),
  talent_id: z.string().optional(),
  outfit_id: z.string().optional(),
  lighting: zLightingSpec.prefault({}),
  scene: zSceneSpec.prefault({}),
  camera: zCameraSpec.prefault({}),
  aspect: zAspect.default("4:5"),
  free_text: z.string().optional(),
  variants: z.number().int().min(1).max(8).default(4),
  channels: z.array(zChannelId).default([]),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  prompt_override: z.string().optional(),
  qa_focus: z.array(zQaFocus).default([]),
  // video-only fields
  duration_s: z.number().min(2).max(15).optional(),
  camera_move: z.string().optional(),
  move_speed: z.enum(["slow", "medium"]).optional(),
  subject_action: z.string().optional(),
  product_visibility: z.enum(["full", "partial", "reveal"]).optional(),
  transition_in: z.enum(["cut", "dissolve", "match_cut", "whip", "light_flare", "fade"]).optional(),
  transition_out: z.enum(["cut", "dissolve", "match_cut", "whip", "light_flare", "fade"]).optional(),
  audio_cue: z.string().optional(),
  text_overlay: z.object({ copy: z.string(), position: z.enum(["top", "center", "bottom"]).default("bottom"), in_s: z.number().default(0.5), out_s: z.number().default(2.5) }).optional(),
  continuous_with_next: z.boolean().optional(),
  keyframe_prompt_hint: z.string().optional(),
  video_prompt_hint: z.string().optional(),
  preset_move: z.string().optional(), // macro_glide | light_sweep | product_spin | push_in | pull_back | floating_roll | half_turn
});
export type ShotSpec = z.infer<typeof zShotSpec>;

export const zShotListItem = z.object({
  title: z.string(),
  format: zShotFormat,
  crop: zBodyCrop.optional(),
  purpose: z.string(),
  product_ids: z.array(z.string()).min(1),
  talent_id: z.string().optional(),
  lighting: zLightingSpec,
  scene: zSceneSpec,
  camera: zCameraSpec,
  aspect: zAspect,
  free_text: z.string().optional(),
  variants: z.number().int().min(1).max(8).default(4),
  channels: z.array(zChannelId).default([]),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  qa_focus: z.array(zQaFocus).default([]),
});

export const zShotList = z.object({
  rationale: z.string(),
  shots: z.array(zShotListItem).min(1).max(24),
  open_questions: z.array(z.string()).default([]),
});
export type ShotList = z.infer<typeof zShotList>;

export const CAMERA_MOVES = ["static", "slow_orbit_cw", "slow_orbit_ccw", "macro_push_in", "pull_out_reveal", "rack_focus_stone_to_face", "rack_focus_face_to_stone", "light_sweep", "tilt_up_reveal", "top_down_spin", "hand_gesture_reveal", "hair_tuck_reveal", "collar_adjust_reveal", "dolly_along_chain", "parallax_slide", "turntable_360"] as const;
export const VIDEO_STRUCTURES = ["reveal_6s", "detail_10s", "lifestyle_15s", "ugc_20s", "gifting_30s", "turntable_loop", "custom"] as const;

export const zStoryboardShot = z.object({
  id: z.string(),
  order: z.number().int(),
  title: z.string(),
  duration_s: z.number().min(2).max(8),
  shot_size: z.enum(["ECU", "CU", "MCU", "MS", "MLS", "WS"]),
  angle: z.enum(["eye_level", "high", "low", "top_down", "three_quarter_45"]),
  camera_move: z.enum(CAMERA_MOVES),
  move_speed: z.enum(["slow", "medium"]).default("slow"),
  lens_mm: z.number().int().default(85),
  aperture: z.enum(["f1.4", "f2", "f2.8", "f4", "f5.6", "f8", "f11", "f16"]).default("f4"),
  focus: z.enum(["product", "face", "rack"]).default("product"),
  lighting: zLightingSpec,
  scene: zSceneSpec,
  subject_action: z.string(),
  product_placement: z.object({ product_id: z.string(), visibility: z.enum(["full", "partial", "reveal"]).default("full"), crop: zBodyCrop.optional() }),
  talent_id: z.string().optional(),
  outfit_id: z.string().optional(),
  invariants: z.array(z.string()).default([]),
  transition_in: z.enum(["cut", "dissolve", "match_cut", "whip", "light_flare", "fade"]).default("cut"),
  transition_out: z.enum(["cut", "dissolve", "match_cut", "whip", "light_flare", "fade"]).default("cut"),
  audio_cue: z.string().default("music"),
  text_overlay: z.object({ copy: z.string(), position: z.enum(["top", "center", "bottom"]), in_s: z.number(), out_s: z.number() }).optional(),
  continuous_with_next: z.boolean().default(false),
  keyframe_prompt_hint: z.string(),
  video_prompt_hint: z.string(),
  qa_flags: z.array(z.string()).default([]),
  format: zShotFormat.default("hero_still_life"),
});
export type StoryboardShot = z.infer<typeof zStoryboardShot>;

export const zStoryboard = z.object({
  title: z.string(),
  duration_s: z.number(),
  structure: z.enum(VIDEO_STRUCTURES),
  aspect: z.enum(["9:16", "1:1", "16:9", "4:5"]),
  music: z.object({ mood: z.string(), bpm_hint: z.number().optional(), source: z.enum(["owner_upload", "none"]).default("owner_upload") }),
  end_card: z.object({ copy: z.string().optional(), duration_s: z.number().default(1.5) }).default({ duration_s: 1.5 }),
  shots: z.array(zStoryboardShot).min(1).max(12),
});
export type Storyboard = z.infer<typeof zStoryboard>;

export const QA_DEFECT_KINDS = ["prong_count", "extra_stone", "missing_stone", "stone_shape", "metal_color", "chain_geometry", "clasp", "placement", "scale", "contact_float", "hands", "face", "text_artifact", "lighting_mismatch", "plastic_sheen", "blur", "composition", "identity", "temporal_consistency", "morph", "sparkle_flicker", "other"] as const;

export const zQAResult = z.object({
  candidate_index: z.number().int(),
  score: z.number().min(0).max(10),
  product_fidelity: z.number().min(0).max(10),
  brief_adherence: z.number().min(0).max(10),
  technical: z.number().min(0).max(10),
  identity_consistency: z.number().min(0).max(10).optional(),
  defects: z.array(z.object({ kind: z.enum(QA_DEFECT_KINDS), where: z.string(), severity: z.enum(["minor", "major"]), fix_prompt: z.string() })).default([]),
  verdict: z.enum(["pass", "retry", "review"]),
  one_line: z.string(),
});
export type QAResult = z.infer<typeof zQAResult>;
export const zQABatch = z.object({ results: z.array(zQAResult) });

export const zCritique = z.object({
  issues: z.array(z.object({ kind: z.enum(QA_DEFECT_KINDS), where: z.string(), fix_prompt: z.string() })),
  summary: z.string(),
});
export type Critique = z.infer<typeof zCritique>;

export const zTalentExpansion = z.object({
  face_notes: z.string(),
  body: z.string(),
  hair_color: z.string(),
  heritage_notes: z.string().optional(),
  style_sentence: z.string(),
});
export type TalentExpansion = z.infer<typeof zTalentExpansion>;

export const zPromptAssist = z.object({ subject_action: z.string(), scene_detail: z.string(), mood_line: z.string() });
export type PromptAssist = z.infer<typeof zPromptAssist>;
