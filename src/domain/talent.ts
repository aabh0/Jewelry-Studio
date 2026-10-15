import { z } from "zod";

export const NECKLINES = ["v", "crew", "scoop", "sweetheart", "high", "turtleneck", "strapless", "off_shoulder", "halter", "collar_shirt"] as const;
export const NAILS = ["natural", "clear", "nude", "soft_pink", "french", "short_neutral"] as const;
export const HAIR_STATES = ["down", "tucked_behind_ear", "up", "pulled_back"] as const;

export const zTalentSpec = z.object({
  gender_presentation: z.enum(["woman", "man", "nonbinary"]).default("woman"),
  age_range: z.enum(["18-24", "25-34", "35-44", "45-60", "60+"]).default("25-34"),
  skin_tone_monk: z.number().int().min(1).max(10).default(5),
  undertone: z.enum(["warm", "cool", "neutral", "olive"]).default("neutral"),
  heritage_notes: z.string().optional(),
  hair: z.object({
    length: z.enum(["cropped", "short", "bob", "shoulder", "long"]).default("shoulder"),
    texture: z.enum(["straight", "wavy", "curly", "coily"]).default("wavy"),
    color: z.string().default("dark brown"),
    default_state: z.enum(HAIR_STATES).default("tucked_behind_ear"),
  }),
  face_notes: z.string().default(""),
  body: z.string().default("balanced proportions"),
  height_cm: z.number().optional(),
  hands: z.object({ nails: z.enum(NAILS).default("natural"), notes: z.string().optional() }).default({ nails: "natural" }),
  ears: z.object({ lobe_visible: z.literal(true).default(true), other_piercings: z.enum(["none", "single", "stack"]).default("none") }).default({ lobe_visible: true, other_piercings: "none" }),
  brief: z.string().default(""),
  consent: z.literal("original_character").default("original_character"),
});
export type TalentSpec = z.infer<typeof zTalentSpec>;

export const zOutfitSpec = z.object({
  description: z.string().default(""),
  palette: z.array(z.string()).default([]),
  neckline: z.enum(NECKLINES).default("v"),
  fabric_finish: z.enum(["matte", "satin", "knit", "linen", "silk"]).default("matte"),
  notes: z.string().optional(),
});
export type OutfitSpec = z.infer<typeof zOutfitSpec>;

export const MONK_WORDS: Record<number, string> = {
  1: "very fair, porcelain skin",
  2: "fair skin",
  3: "light skin",
  4: "light-medium skin",
  5: "medium skin",
  6: "medium-tan skin",
  7: "tan, warm brown skin",
  8: "brown skin",
  9: "deep brown skin",
  10: "very deep, rich dark skin",
};

export function describeTalent(t: TalentSpec): string {
  const age = t.age_range === "60+" ? "in their sixties or older" : `aged ${t.age_range.replace("-", " to ")}`;
  const subject = t.gender_presentation === "woman" ? "woman" : t.gender_presentation === "man" ? "man" : "person";
  const parts = [
    `an original adult ${subject} ${age} with ${MONK_WORDS[t.skin_tone_monk]} and a ${t.undertone} undertone`,
    t.heritage_notes ? t.heritage_notes : "",
    `${t.hair.length} ${t.hair.texture} ${t.hair.color} hair worn ${t.hair.default_state.replace(/_/g, " ")}`,
    t.face_notes ? t.face_notes : "mature adult facial structure with defined jawline and cheekbones, natural asymmetry",
    t.body,
    `${t.hands.nails.replace(/_/g, " ")} nails, smooth well-kept hands${t.hands.notes ? ", " + t.hands.notes : ""}`,
    t.ears.other_piercings === "none" ? "no other ear piercings" : `${t.ears.other_piercings} additional ear piercing${t.ears.other_piercings === "stack" ? "s" : ""}`,
  ].filter(Boolean);
  return parts.join("; ");
}

export function describeOutfit(o: OutfitSpec): string {
  const palette = o.palette.length ? ` in ${o.palette.join(", ")}` : "";
  return `${o.description || "simple elegant wardrobe"}${palette}, ${o.neckline.replace(/_/g, " ")} neckline, ${o.fabric_finish} fabric with no logos or prints near the jewelry${o.notes ? "; " + o.notes : ""}`;
}

/** Warnings from the casting rules in docs/research/jewelry-craft.md §7. */
export function castingWarnings(t: TalentSpec, outfit: OutfitSpec | undefined, productCategory: string, metalType: string): string[] {
  const w: string[] = [];
  if (productCategory === "necklace" && outfit) {
    if (outfit.neckline === "halter") w.push("Halter necklines compete with necklaces; consider earrings or a different outfit.");
    if (outfit.neckline === "turtleneck") w.push("Turtlenecks suit long chains worn over the fabric; short pendants will be hidden.");
  }
  if (productCategory === "earring" && t.hair.default_state === "down" && t.hair.length !== "cropped" && t.hair.length !== "short") w.push("Hair down hides earrings; set hair state to tucked or up.");
  const warm = ["yellow_gold", "rose_gold", "vermeil", "gold_plated", "gold_filled"].includes(metalType);
  if (warm && t.undertone === "cool") w.push("Cool undertone with warm metal: fine for editorial, but neutral wardrobe tones will keep the gold from reading brassy.");
  if (!warm && t.undertone === "warm") w.push("Warm undertone with white metal: add a cool or neutral wardrobe palette so the metal stays bright.");
  return w;
}
