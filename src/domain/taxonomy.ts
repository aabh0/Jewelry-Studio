import { z } from "zod";

export const JEWELRY_CATEGORIES = ["ring", "necklace", "earring", "bracelet", "brooch", "anklet", "body_jewelry", "watch", "cufflink"] as const;
export const RING_SUBTYPES = ["solitaire", "band", "eternity", "half_eternity", "signet", "cocktail", "stackable", "halo", "three_stone", "cluster", "dome", "chevron"] as const;
export const NECKLACE_SUBTYPES = ["pendant", "chain", "choker", "lariat", "station", "collar", "tennis", "layered", "locket"] as const;
export const EARRING_SUBTYPES = ["stud", "huggie", "hoop", "drop", "chandelier", "ear_cuff", "climber", "threader", "jacket", "clip_on"] as const;
export const BRACELET_SUBTYPES = ["tennis", "bangle", "cuff", "chain", "charm", "beaded", "cord", "id_bar"] as const;
export const OTHER_SUBTYPES = ["standard"] as const;

export const SUBTYPES_BY_CATEGORY: Record<(typeof JEWELRY_CATEGORIES)[number], readonly string[]> = {
  ring: RING_SUBTYPES,
  necklace: NECKLACE_SUBTYPES,
  earring: EARRING_SUBTYPES,
  bracelet: BRACELET_SUBTYPES,
  brooch: OTHER_SUBTYPES,
  anklet: OTHER_SUBTYPES,
  body_jewelry: ["nose_stud", "septum", "navel", "cartilage"],
  watch: ["dress", "sport", "jewelry"],
  cufflink: OTHER_SUBTYPES,
};

export const METALS = ["yellow_gold", "white_gold", "rose_gold", "platinum", "sterling_silver", "vermeil", "gold_plated", "gold_filled", "titanium", "stainless_steel", "enamel", "mixed_metal"] as const;
export const KARATS = [10, 14, 18, 22, 24] as const;
export const FINISHES = ["high_polish", "satin", "brushed", "hammered", "matte", "sandblast", "florentine"] as const;
export const STONE_TYPES = ["diamond", "lab_diamond", "moissanite", "sapphire", "ruby", "emerald", "aquamarine", "morganite", "tanzanite", "amethyst", "citrine", "garnet", "peridot", "topaz", "tourmaline", "opal", "turquoise", "lapis", "onyx", "moonstone", "labradorite", "spinel", "alexandrite", "jade", "pearl", "cubic_zirconia", "other"] as const;
export const STONE_SHAPES = ["round_brilliant", "princess", "cushion", "oval", "emerald", "asscher", "radiant", "pear", "marquise", "heart", "baguette", "trillion", "rose_cut", "old_european", "cabochon", "bead", "irregular"] as const;
export const STONE_ROLES = ["center", "side", "accent", "pave", "halo", "melee", "strand"] as const;
export const SETTINGS = ["prong", "bezel", "half_bezel", "pave", "micro_pave", "channel", "bar", "halo", "double_halo", "tension", "flush", "cluster", "invisible", "bead", "cathedral", "basket", "trellis"] as const;
export const CLASPS = ["lobster", "spring_ring", "toggle", "box", "magnetic", "barrel", "hook", "slide", "none"] as const;
export const EARRING_BACKS = ["butterfly", "screw", "lever", "latch", "french_hook", "hinged"] as const;
export const CHAIN_STYLES = ["cable", "curb", "rope", "box", "figaro", "paperclip", "snake", "herringbone", "rolo", "wheat", "bead"] as const;
export const PEARL_TYPES = ["akoya", "freshwater", "south_sea", "tahitian", "baroque", "keshi"] as const;
export const FINGERS = ["thumb", "index", "middle", "ring", "pinky"] as const;
export const HANDS = ["left", "right"] as const;
export const EAR_SIDES = ["left", "right", "both"] as const;
export const NECK_LANDMARKS = ["base_of_neck", "base_of_throat", "collarbone", "below_collarbone", "sternum", "mid_chest", "below_bust"] as const;
export const STEP_CUTS = new Set<string>(["emerald", "asscher", "baguette"]);
export const OPAQUE_STONES = new Set<string>(["pearl", "opal", "turquoise", "lapis", "onyx", "jade", "moonstone", "labradorite"]);
export const WHITE_METALS = new Set<string>(["white_gold", "platinum", "sterling_silver", "titanium", "stainless_steel"]);
export const WARM_METALS = new Set<string>(["yellow_gold", "rose_gold", "vermeil", "gold_plated", "gold_filled"]);

export const OCCASIONS = ["valentines", "mothers_day", "holiday", "eid", "bridal_wedding", "graduation", "anniversary", "birthday", "new_year", "diwali", "lunar_new_year", "black_friday", "none"] as const;

export const SHOT_FORMATS = ["packshot_white", "hero_still_life", "macro_detail", "on_model_beauty_crop", "lifestyle_editorial", "flat_lay", "ghost_mannequin", "hand_model", "couples_gifting", "seasonal", "social_ugc_tryon", "unboxing"] as const;
export const BODY_CROPS = ["ear", "neck", "decolletage", "hand", "wrist", "face_34", "half_body", "full_body"] as const;
export const ASPECTS = ["1:1", "4:5", "3:4", "2:3", "9:16", "16:9", "3:2", "21:9", "5:4", "4:3"] as const;
export const QA_FOCUS = ["prong_count", "stone_shape", "metal_color", "chain_geometry", "clasp", "placement", "scale", "hands", "identity", "text"] as const;

export const zCategory = z.enum(JEWELRY_CATEGORIES);
export const zMetal = z.enum(METALS);
export const zFinish = z.enum(FINISHES);
export const zStoneType = z.enum(STONE_TYPES);
export const zStoneShape = z.enum(STONE_SHAPES);
export const zStoneRole = z.enum(STONE_ROLES);
export const zSetting = z.enum(SETTINGS);
export const zClasp = z.enum(CLASPS);
export const zChainStyle = z.enum(CHAIN_STYLES);
export const zFinger = z.enum(FINGERS);
export const zHand = z.enum(HANDS);
export const zEarSide = z.enum(EAR_SIDES);
export const zNeckLandmark = z.enum(NECK_LANDMARKS);
export const zOccasion = z.enum(OCCASIONS);
export const zShotFormat = z.enum(SHOT_FORMATS);
export const zBodyCrop = z.enum(BODY_CROPS);
export const zAspect = z.enum(ASPECTS);
export const zQaFocus = z.enum(QA_FOCUS);

export type JewelryCategory = z.infer<typeof zCategory>;
export type ShotFormat = z.infer<typeof zShotFormat>;
export type Aspect = z.infer<typeof zAspect>;

export function humanize(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
