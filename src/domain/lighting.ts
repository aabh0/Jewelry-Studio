import { z } from "zod";
import type { ProductSpec } from "./product";
import { materialProfile } from "./product";

export const LIGHT_SETUPS = ["one_light", "key_fill", "key_fill_rim", "tent_wrap", "gradient_panel", "sparkle_accent", "backlit_glow", "window", "practical"] as const;
export const KEY_QUALITIES = ["soft_large", "medium", "hard_point", "mixed_soft_plus_point"] as const;
export const KEY_DIRECTIONS = ["top", "top_front", "top_back", "side_left", "side_right", "front", "under", "high_45_left", "high_45_right"] as const;
export const FILLS = ["none", "white_card", "silver_card", "second_soft", "ambient"] as const;
export const NEGATIVE_FILLS = ["none", "black_card_left", "black_card_right", "black_card_top", "black_gradient_reflection"] as const;
export const RIMS = ["none", "edge_light", "hair_light", "double_rim"] as const;
export const SPARKLES = ["none", "low", "medium", "high"] as const;
export const REFLECTION_STYLES = ["clean_gradient", "environment_reflection", "mirror_black", "studio_white_wrap"] as const;
export const COLOR_TEMPS = [2700, 3200, 4000, 4500, 5000, 5500, 6500] as const;
export const WHITE_BALANCES = ["neutral_locked", "warm_bias", "cool_bias"] as const;
export const MOODS = ["high_key", "low_key", "studio_clean", "window_daylight", "golden_hour", "blue_hour", "overcast", "candlelight", "neon", "moody_spotlight", "dappled_shadow"] as const;
export const BACKGROUNDS = ["seamless_white", "seamless_grey", "seamless_black", "black_velvet", "marble_white", "marble_black", "travertine", "slate", "sandstone", "concrete", "silk", "satin", "linen", "velvet_colored", "water_surface", "wet_stone", "sand", "glass", "mirror", "acrylic_gradient", "gradient_paper", "foliage", "fabric_drape", "wood_light", "wood_dark", "custom"] as const;
export const SURFACE_FINISHES = ["matte", "satin", "glossy", "textured"] as const;
export const LENSES = [24, 35, 50, 85, 100, 135] as const;
export const APERTURES = ["f1.4", "f2", "f2.8", "f4", "f5.6", "f8", "f11", "f16"] as const;
export const SHOT_SIZES = ["ECU", "CU", "MCU", "MS", "MLS", "WS"] as const;
export const ANGLES = ["eye_level", "high", "low", "top_down", "three_quarter_45"] as const;

export const zLightingSpec = z.object({
  setup: z.enum(LIGHT_SETUPS).default("key_fill_rim"),
  key_quality: z.enum(KEY_QUALITIES).default("soft_large"),
  key_direction: z.enum(KEY_DIRECTIONS).default("high_45_left"),
  fill: z.enum(FILLS).default("white_card"),
  negative_fill: z.enum(NEGATIVE_FILLS).default("black_card_right"),
  rim: z.enum(RIMS).default("edge_light"),
  sparkle: z.enum(SPARKLES).default("medium"),
  reflection_style: z.enum(REFLECTION_STYLES).default("clean_gradient"),
  color_temp_k: z.number().int().default(5500),
  white_balance: z.enum(WHITE_BALANCES).default("neutral_locked"),
  mood: z.enum(MOODS).default("studio_clean"),
  background: z.enum(BACKGROUNDS).default("seamless_grey"),
  background_custom: z.string().optional(),
  surface_finish: z.enum(SURFACE_FINISHES).default("matte"),
});
export type LightingSpec = z.infer<typeof zLightingSpec>;

export const zCameraSpec = z.object({
  lens_mm: z.number().int().default(100),
  aperture: z.enum(APERTURES).default("f8"),
  angle: z.enum(ANGLES).default("three_quarter_45"),
  shot_size: z.enum(SHOT_SIZES).default("CU"),
  focus: z.enum(["product", "face", "rack"]).default("product"),
});
export type CameraSpec = z.infer<typeof zCameraSpec>;

export const zSceneSpec = z.object({
  environment: z.string().default(""),
  props: z.array(z.string()).default([]),
  copy_safe_area: z.enum(["left", "right", "top", "bottom", "center", "none"]).default("none"),
  season: z.string().optional(),
  time_of_day: z.string().optional(),
});
export type SceneSpec = z.infer<typeof zSceneSpec>;

const DIRECTION_WORDS: Record<(typeof KEY_DIRECTIONS)[number], string> = {
  top: "directly overhead",
  top_front: "overhead and slightly in front",
  top_back: "overhead and behind as a three-quarter back rim",
  side_left: "raking from camera-left",
  side_right: "raking from camera-right",
  front: "frontal and flat",
  under: "transmitted from below",
  high_45_left: "45° high from camera-left",
  high_45_right: "45° high from camera-right",
};
const QUALITY_WORDS: Record<(typeof KEY_QUALITIES)[number], string> = {
  soft_large: "a large diffused softbox",
  medium: "a medium umbrella or bounce source",
  hard_point: "a hard point source (gridded spot or fiber-optic head)",
  mixed_soft_plus_point: "a large soft source plus a small hard point accent",
};
const SETUP_WORDS: Record<(typeof LIGHT_SETUPS)[number], string> = {
  one_light: "single-light setup",
  key_fill: "key and fill setup",
  key_fill_rim: "key, fill and rim setup",
  tent_wrap: "diffusion tent wrap-around light",
  gradient_panel: "gradient panel lighting that paints smooth tonal gradients across the metal",
  sparkle_accent: "soft key with small point-source sparkle accents",
  backlit_glow: "soft key with transmitted backlight glowing through the stones",
  window: "soft window light",
  practical: "motivated practical light visible in the scene",
};
const FILL_WORDS: Record<(typeof FILLS)[number], string> = { none: "no fill", white_card: "white-card fill", silver_card: "silver-card fill", second_soft: "a second soft fill", ambient: "ambient fill" };
const NEG_WORDS: Record<(typeof NEGATIVE_FILLS)[number], string> = {
  none: "",
  black_card_left: "a black card on the left reflected in the polished metal for edge definition",
  black_card_right: "a black card on the right reflected in the polished metal for edge definition",
  black_card_top: "a black card overhead reflected in the metal",
  black_gradient_reflection: "a black-to-white gradient reflection running along the metal",
};
const RIM_WORDS: Record<(typeof RIMS)[number], string> = { none: "", edge_light: "a narrow edge light catching stone edges and metal rims", hair_light: "a hair light for separation", double_rim: "double rim lights for separation" };
const SPARKLE_WORDS: Record<(typeof SPARKLES)[number], string> = {
  none: "no point-source sparkle; smooth luster",
  low: "subtle facet sparkle from one small point source",
  medium: "lively facet sparkle from a couple of small hard point sources balanced with soft fill",
  high: "strong scintillation from multiple pin lights, crisp specular fire in every facet",
};
const REFL_WORDS: Record<(typeof REFLECTION_STYLES)[number], string> = {
  clean_gradient: "polished surfaces show clean, smooth gradient reflections",
  environment_reflection: "polished surfaces reflect the real environment, bending along the curves",
  mirror_black: "polished surfaces reflect deep black with a single bright highlight band",
  studio_white_wrap: "polished surfaces reflect a soft white studio wrap",
};
const MOOD_WORDS: Record<(typeof MOODS)[number], string> = {
  high_key: "bright high-key mood",
  low_key: "low-key mood with deep clean shadows",
  studio_clean: "clean studio mood",
  window_daylight: "natural window-daylight mood",
  golden_hour: "golden-hour mood with warm low sun",
  blue_hour: "cool blue-hour mood",
  overcast: "soft overcast mood",
  candlelight: "intimate candlelit mood with warm bokeh",
  neon: "editorial neon mood with colored rims",
  moody_spotlight: "moody single-spotlight mood",
  dappled_shadow: "dappled foliage shadows across the scene",
};
export const BACKGROUND_WORDS: Record<(typeof BACKGROUNDS)[number], string> = {
  seamless_white: "seamless white studio backdrop",
  seamless_grey: "seamless light-grey studio backdrop",
  seamless_black: "seamless black studio backdrop",
  black_velvet: "black velvet",
  marble_white: "white polished marble",
  marble_black: "black polished marble",
  travertine: "travertine stone",
  slate: "dark slate",
  sandstone: "warm sandstone",
  concrete: "raw concrete",
  silk: "draped silk",
  satin: "draped satin",
  linen: "natural linen",
  velvet_colored: "colored velvet",
  water_surface: "a still water surface",
  wet_stone: "wet dark stone",
  sand: "fine sand",
  glass: "clear glass",
  mirror: "a mirror surface",
  acrylic_gradient: "a gradient acrylic panel",
  gradient_paper: "gradient paper",
  foliage: "green foliage",
  fabric_drape: "draped fabric",
  wood_light: "light natural wood",
  wood_dark: "dark wood",
  custom: "",
};

/** Compile a LightingSpec into the [LIGHTING] prose block. */
export function describeLighting(l: LightingSpec, opts: { video?: boolean } = {}): string {
  const sparkle = opts.video && l.sparkle === "high" ? "medium" : l.sparkle;
  const sentences: string[] = [
    `${SETUP_WORDS[l.setup]}: key from ${QUALITY_WORDS[l.key_quality]} ${DIRECTION_WORDS[l.key_direction]}, ${FILL_WORDS[l.fill]}${RIM_WORDS[l.rim] ? ", " + RIM_WORDS[l.rim] : ""}.`,
  ];
  if (NEG_WORDS[l.negative_fill]) sentences.push(`${NEG_WORDS[l.negative_fill][0].toUpperCase()}${NEG_WORDS[l.negative_fill].slice(1)}.`);
  sentences.push(`${SPARKLE_WORDS[sparkle][0].toUpperCase()}${SPARKLE_WORDS[sparkle].slice(1)}.`);
  sentences.push(`${REFL_WORDS[l.reflection_style][0].toUpperCase()}${REFL_WORDS[l.reflection_style].slice(1)}.`);
  sentences.push(`Color temperature ${l.color_temp_k}K${l.white_balance === "neutral_locked" ? ", white balance locked neutral so white metals and diamonds stay neutral" : l.white_balance === "warm_bias" ? " with a gentle warm bias on skin and scene while the metal stays true" : " with a cool bias"}.`);
  sentences.push(`${MOOD_WORDS[l.mood][0].toUpperCase()}${MOOD_WORDS[l.mood].slice(1)}; shadows fall with a soft gradient falloff and one coherent contact shadow grounds the piece.`);
  if (opts.video) sentences.push("Lighting is static for the whole clip: no flicker, no strobing speculars.");
  return sentences.join(" ");
}

export function describeBackground(l: LightingSpec): string {
  const base = l.background === "custom" ? l.background_custom ?? "a custom surface" : BACKGROUND_WORDS[l.background];
  return `${base} with a ${l.surface_finish} finish`;
}

/** Apply material rules (§11) as defaults/overrides. Returns a new spec plus notes for the UI. */
export function applyMaterialRules(l: LightingSpec, product: ProductSpec, opts: { video?: boolean } = {}): { lighting: LightingSpec; notes: string[] } {
  const p = materialProfile(product);
  const out: LightingSpec = { ...l };
  const notes: string[] = [];
  if (p.hasDiamond) {
    if (out.sparkle === "none") { out.sparkle = "medium"; notes.push("Diamonds: sparkle raised to medium."); }
    if (out.negative_fill === "none") { out.negative_fill = "black_card_right"; notes.push("Diamonds: black negative fill added for facet contrast."); }
    out.white_balance = "neutral_locked";
  }
  if (p.hasStepCut) {
    if (out.key_quality === "hard_point") { out.key_quality = "soft_large"; notes.push("Step cuts: large soft key instead of hard points."); }
    if (out.sparkle === "high") { out.sparkle = "low"; notes.push("Step cuts: sparkle lowered (broad flashes, not pin sparkle)."); }
  }
  if (p.hasColoredTransparent && out.setup === "one_light") { out.setup = "backlit_glow"; notes.push("Colored transparent stones: soft key with a transmitted glow."); }
  if (p.hasOpaque || p.hasPearl) {
    if (out.sparkle !== "none" && out.sparkle !== "low") { out.sparkle = "low"; notes.push("Pearls/opaque stones: sparkle set to low."); }
    if (out.key_quality === "hard_point") { out.key_quality = "soft_large"; notes.push("Pearls/opaque stones: single soft source for luster."); }
    if (p.hasPearl && out.setup !== "one_light" && out.setup !== "window") { out.setup = "one_light"; notes.push("Pearls: one light source avoids multiple distorting reflections."); }
  }
  if (p.whiteMetal) {
    out.white_balance = "neutral_locked";
    if (out.color_temp_k < 4500) { out.color_temp_k = 5000; notes.push("White metal: color temperature raised to keep the metal neutral."); }
    if (out.reflection_style === "environment_reflection" && out.mood === "golden_hour") notes.push("White metal in golden hour: expect warm casts; prefer neutral environment reflections.");
  }
  if (p.enamel && out.key_quality === "hard_point") { out.key_quality = "soft_large"; notes.push("Enamel: diffused light, no hard speculars."); }
  if (p.highPolish && out.reflection_style === "studio_white_wrap") notes.push("High polish: define what the metal reflects; a clean gradient reads more premium.");
  if (opts.video && out.sparkle === "high") { out.sparkle = "medium"; notes.push("Video: sparkle capped at medium to reduce flicker."); }
  return { lighting: out, notes };
}

export const LIGHTING_PRESETS: Record<string, { name: string; description: string; spec: Partial<LightingSpec> }> = {
  studio_packshot: { name: "Studio packshot", description: "Tent wrap, 5500K, seamless white, low–medium sparkle.", spec: { setup: "tent_wrap", key_quality: "soft_large", key_direction: "top_front", fill: "white_card", negative_fill: "black_gradient_reflection", rim: "none", sparkle: "low", reflection_style: "studio_white_wrap", color_temp_k: 5500, mood: "high_key", background: "seamless_white", surface_finish: "matte" } },
  clean_studio: { name: "Clean studio", description: "Seamless grey gradient, soft frontal key, minimal shadow.", spec: { setup: "key_fill", key_quality: "soft_large", key_direction: "high_45_left", fill: "white_card", negative_fill: "black_card_right", rim: "edge_light", sparkle: "medium", reflection_style: "clean_gradient", color_temp_k: 5500, mood: "studio_clean", background: "seamless_grey", surface_finish: "matte" } },
  black_velvet_luxury: { name: "Black velvet luxury", description: "Key, fill and rim; hard-point sparkle; 5000K; black velvet.", spec: { setup: "sparkle_accent", key_quality: "mixed_soft_plus_point", key_direction: "high_45_right", fill: "none", negative_fill: "black_gradient_reflection", rim: "double_rim", sparkle: "high", reflection_style: "mirror_black", color_temp_k: 5000, mood: "low_key", background: "black_velvet", surface_finish: "matte" } },
  marble_morning: { name: "Marble morning", description: "Window light, 5500K, white marble, soft shadows.", spec: { setup: "window", key_quality: "soft_large", key_direction: "side_left", fill: "white_card", negative_fill: "none", rim: "none", sparkle: "low", reflection_style: "environment_reflection", color_temp_k: 5500, mood: "window_daylight", background: "marble_white", surface_finish: "glossy" } },
  golden_hour_skin: { name: "Golden hour on skin", description: "Low warm sun, warm bias on skin, neutral metal.", spec: { setup: "practical", key_quality: "medium", key_direction: "top_back", fill: "silver_card", negative_fill: "none", rim: "edge_light", sparkle: "medium", reflection_style: "environment_reflection", color_temp_k: 4500, white_balance: "warm_bias", mood: "golden_hour", background: "custom", background_custom: "a sunlit terrace", surface_finish: "textured" } },
  candlelit_gift: { name: "Candlelit gift", description: "3200K, low key, bokeh.", spec: { setup: "practical", key_quality: "medium", key_direction: "side_right", fill: "none", negative_fill: "none", rim: "none", sparkle: "medium", reflection_style: "environment_reflection", color_temp_k: 3200, white_balance: "warm_bias", mood: "candlelight", background: "linen", surface_finish: "matte" } },
  luxury_editorial: { name: "Luxury editorial", description: "Polished reflections, marble or velvet, jewel-tone backdrop.", spec: { setup: "key_fill_rim", key_quality: "soft_large", key_direction: "high_45_left", fill: "none", negative_fill: "black_card_right", rim: "double_rim", sparkle: "medium", reflection_style: "clean_gradient", color_temp_k: 5000, mood: "low_key", background: "velvet_colored", surface_finish: "matte" } },
  water_reflection: { name: "Water reflection", description: "Top-back rim over a still water surface.", spec: { setup: "key_fill_rim", key_quality: "soft_large", key_direction: "top_back", fill: "white_card", negative_fill: "none", rim: "edge_light", sparkle: "medium", reflection_style: "environment_reflection", color_temp_k: 5500, mood: "studio_clean", background: "water_surface", surface_finish: "glossy" } },
  botanical_shadows: { name: "Botanical shadows", description: "Hard key through leaves, dappled shadow.", spec: { setup: "one_light", key_quality: "hard_point", key_direction: "high_45_right", fill: "white_card", negative_fill: "none", rim: "none", sparkle: "medium", reflection_style: "environment_reflection", color_temp_k: 5500, mood: "dappled_shadow", background: "travertine", surface_finish: "matte" } },
  neon_edit: { name: "Neon editorial", description: "Colored rims; metal color accuracy at risk (editorial only).", spec: { setup: "key_fill_rim", key_quality: "hard_point", key_direction: "side_left", fill: "none", negative_fill: "none", rim: "double_rim", sparkle: "high", reflection_style: "mirror_black", color_temp_k: 4000, white_balance: "cool_bias", mood: "neon", background: "seamless_black", surface_finish: "glossy" } },
};

export function lightingFromPreset(id: string): LightingSpec {
  const p = LIGHTING_PRESETS[id];
  return zLightingSpec.parse({ ...(p?.spec ?? {}) });
}
