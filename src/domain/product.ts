import { z } from "zod";
import {
  zCategory, zMetal, zFinish, zStoneType, zStoneShape, zStoneRole, zSetting, zClasp, zChainStyle, zFinger, zHand, zEarSide, zNeckLandmark,
  SUBTYPES_BY_CATEGORY, STEP_CUTS, OPAQUE_STONES, WHITE_METALS, WARM_METALS, humanize,
} from "./taxonomy";
import { stoneMm, chainLandmark, bandWidthClass, hoopClass, studClass, dropClass, FINGER_BASE_WIDTH_MM } from "./sizes";

export const zStone = z.object({
  role: zStoneRole.default("center"),
  type: zStoneType.default("diamond"),
  shape: zStoneShape.default("round_brilliant"),
  carat: z.number().positive().optional(),
  mm: z.array(z.number().positive()).min(1).max(2).optional(),
  count: z.number().int().positive().optional(),
  color: z.string().optional(),
  clarity: z.string().optional(),
  cut: z.enum(["faceted", "cabochon", "rose", "bead"]).optional(),
  setting: z.object({ type: zSetting, prong_count: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(6), z.literal(8)]).optional() }).optional(),
  pearl_type: z.string().optional(),
});

export const zProductSpec = z.object({
  category: zCategory,
  subtype: z.string().optional(),
  metal: z.object({
    type: zMetal,
    karat: z.union([z.literal(10), z.literal(14), z.literal(18), z.literal(22), z.literal(24)]).optional(),
    finish: zFinish.default("high_polish"),
    plating: z.enum(["rhodium", "none"]).optional(),
  }),
  stones: z.array(zStone).default([]),
  setting: z.object({ type: zSetting, prong_count: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(6), z.literal(8)]).optional(), halo: z.boolean().optional() }).optional(),
  chain: z.object({ style: zChainStyle.optional(), length_in: z.number().positive().optional(), width_mm: z.number().positive().optional(), clasp: zClasp.optional() }).optional(),
  dimensions: z
    .object({
      band_width_mm: z.number().positive().optional(),
      band_thickness_mm: z.number().positive().optional(),
      face_mm: z.array(z.number().positive()).length(2).optional(),
      diameter_mm: z.number().positive().optional(),
      length_mm: z.number().positive().optional(),
      drop_mm: z.number().positive().optional(),
      inner_diameter_mm: z.number().positive().optional(),
      case_mm: z.number().positive().optional(),
      width_mm: z.number().positive().optional(),
    })
    .optional(),
  wear: z
    .object({
      hand: zHand.optional(),
      finger: zFinger.optional(),
      stack_position: z.number().int().positive().optional(),
      ear_side: zEarSide.optional(),
      sits_at: zNeckLandmark.optional(),
    })
    .optional(),
  size_label: z.string().optional(),
  hallmarks: z.array(z.string()).default([]),
  packaging: z.string().optional(),
  description_freeform: z.string().optional(),
});

export type ProductSpec = z.infer<typeof zProductSpec>;
export type Stone = z.infer<typeof zStone>;

export interface ProductValidation {
  errors: string[];
  warnings: string[];
}

export function validateProductSpec(spec: ProductSpec): ProductValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const subs = SUBTYPES_BY_CATEGORY[spec.category];
  if (spec.subtype && !subs.includes(spec.subtype)) errors.push(`Subtype "${spec.subtype}" is not valid for ${spec.category}.`);
  const prongSettings = [spec.setting, ...spec.stones.map((s) => s.setting)].filter(Boolean);
  for (const s of prongSettings) if (s && s.type === "prong" && !s.prong_count) errors.push("Prong settings need an explicit prong count (AI drifts between 4 and 6 prongs).");
  if (spec.category === "necklace" && !spec.chain?.length_in) warnings.push("Necklace chain length missing; defaulting to 18 in.");
  if (spec.category === "bracelet" && !spec.chain?.length_in && !spec.dimensions?.inner_diameter_mm) warnings.push("Bracelet length missing; defaulting to 7 in.");
  if (spec.stones.length === 0 && !["band", "signet", "chain", "bangle", "cuff"].includes(spec.subtype ?? "")) warnings.push("No stones listed; confirm the piece is plain metal.");
  return { errors, warnings };
}

/** Fill derived defaults (stone mm from carat, wear defaults, chain defaults). Returns a new spec. */
export function normalizeProductSpec(input: ProductSpec): ProductSpec {
  const spec: ProductSpec = structuredClone(input);
  spec.stones = spec.stones.map((s) => {
    if (!s.mm && s.carat) return { ...s, mm: stoneMm(s.shape, s.carat) };
    return s;
  });
  if (spec.category === "necklace") {
    spec.chain = { ...spec.chain, length_in: spec.chain?.length_in ?? 18, clasp: spec.chain?.clasp ?? "lobster" };
    const landmark = chainLandmark(spec.chain.length_in!).landmark as NonNullable<ProductSpec["wear"]>["sits_at"];
    spec.wear = { ...spec.wear, sits_at: spec.wear?.sits_at ?? landmark };
  }
  if (spec.category === "bracelet" && !spec.chain?.length_in && !spec.dimensions?.inner_diameter_mm) {
    spec.chain = { ...spec.chain, length_in: 7 };
  }
  if (spec.category === "ring") {
    const sub = spec.subtype ?? "solitaire";
    const defaults: Record<string, { hand: "left" | "right"; finger: "thumb" | "index" | "middle" | "ring" | "pinky" }> = {
      solitaire: { hand: "left", finger: "ring" },
      band: { hand: "left", finger: "ring" },
      eternity: { hand: "left", finger: "ring" },
      half_eternity: { hand: "left", finger: "ring" },
      halo: { hand: "left", finger: "ring" },
      three_stone: { hand: "left", finger: "ring" },
      cocktail: { hand: "right", finger: "index" },
      signet: { hand: "right", finger: "pinky" },
      stackable: { hand: "right", finger: "middle" },
    };
    const d = defaults[sub] ?? { hand: "right", finger: "middle" };
    spec.wear = { hand: d.hand, finger: d.finger, ...spec.wear };
  }
  if (spec.category === "earring") spec.wear = { ear_side: "both", ...spec.wear };
  return spec;
}

function metalPhrase(spec: ProductSpec): string {
  const m = spec.metal;
  const karat = m.karat ? `${m.karat}k ` : "";
  const plating = m.plating === "rhodium" ? " rhodium-plated" : "";
  return `${karat}${humanize(m.type).toLowerCase()}${plating}, ${humanize(m.finish).toLowerCase()} finish`;
}

function stonePhrase(s: Stone): string {
  const parts: string[] = [];
  if (s.count && s.count > 1) parts.push(`${s.count}`);
  else parts.push(s.role === "center" ? "one" : "");
  if (s.carat) parts.push(`${s.carat} ct`);
  if (s.mm) parts.push(`${s.mm.join(" × ")} mm`);
  parts.push(humanize(s.shape).toLowerCase());
  if (s.cut === "cabochon") parts.push("cabochon");
  parts.push(humanize(s.type).toLowerCase());
  if (s.pearl_type) parts.push(`(${s.pearl_type})`);
  if (s.color) parts.push(s.color);
  const role = s.role === "center" ? "center stone" : `${s.role} stones`;
  const setting = s.setting ? ` in a ${s.setting.prong_count ? `${s.setting.prong_count}-prong ` : ""}${humanize(s.setting.type).toLowerCase()} setting` : "";
  return `${parts.filter(Boolean).join(" ")} as ${role}${setting}`;
}

/** Full structured product description for prompts (metal → stones → setting → chain → dimensions → wear). */
export function describeProduct(specIn: ProductSpec): string {
  const spec = normalizeProductSpec(specIn);
  const lines: string[] = [];
  const kind = `${spec.subtype ? humanize(spec.subtype).toLowerCase() + " " : ""}${humanize(spec.category).toLowerCase()}`;
  lines.push(`A ${kind} in ${metalPhrase(spec)}.`);
  for (const s of spec.stones) lines.push(`Stones: ${stonePhrase(s)}.`);
  if (spec.setting) {
    const pc = spec.setting.prong_count ? `${spec.setting.prong_count}-prong ` : "";
    lines.push(`Primary setting: ${pc}${humanize(spec.setting.type).toLowerCase()}${spec.setting.halo ? " with halo" : ""}.`);
  }
  if (spec.chain) {
    const c = spec.chain;
    const len = c.length_in ? `${c.length_in} in` : "";
    const lm = c.length_in ? `, ${chainLandmark(c.length_in).label}` : "";
    lines.push(`Chain: ${c.style ? humanize(c.style).toLowerCase() + " " : ""}${c.width_mm ? c.width_mm + " mm wide " : ""}${len}${lm}${c.clasp && c.clasp !== "none" ? `, ${humanize(c.clasp).toLowerCase()} clasp` : ""}.`);
  }
  const d = spec.dimensions;
  if (d) {
    const dims: string[] = [];
    if (d.band_width_mm) dims.push(`band ${d.band_width_mm} mm wide (${bandWidthClass(d.band_width_mm)})`);
    if (d.band_thickness_mm) dims.push(`${d.band_thickness_mm} mm thick`);
    if (d.face_mm) dims.push(`face ${d.face_mm[0]} × ${d.face_mm[1]} mm`);
    if (d.diameter_mm) dims.push(spec.category === "earring" ? `${d.diameter_mm} mm diameter (${spec.subtype === "stud" ? studClass(d.diameter_mm) : hoopClass(d.diameter_mm)})` : `${d.diameter_mm} mm diameter`);
    if (d.drop_mm) dims.push(`${d.drop_mm} mm drop (${dropClass(d.drop_mm)})`);
    if (d.length_mm) dims.push(`${d.length_mm} mm long`);
    if (d.width_mm) dims.push(`${d.width_mm} mm wide`);
    if (d.inner_diameter_mm) dims.push(`${d.inner_diameter_mm} mm inner diameter`);
    if (d.case_mm) dims.push(`${d.case_mm} mm case`);
    if (dims.length) lines.push(`Dimensions: ${dims.join(", ")}.`);
  }
  if (spec.size_label) lines.push(`Size: ${spec.size_label}.`);
  if (spec.hallmarks.length) lines.push(`Hallmarks/engraving present: ${spec.hallmarks.join(", ")} (must read exactly or be out of frame).`);
  if (spec.description_freeform) lines.push(spec.description_freeform.trim());
  return lines.join(" ");
}

/** Where and how the piece sits on the body, plus a scale sentence. */
export function describeWear(specIn: ProductSpec): string {
  const spec = normalizeProductSpec(specIn);
  const w = spec.wear ?? {};
  switch (spec.category) {
    case "ring": {
      const stone = spec.stones.find((s) => s.role === "center");
      const scale = stone?.mm ? ` Scale: the ${stone.mm[0]} mm stone sits on a finger about ${FINGER_BASE_WIDTH_MM} mm wide.` : "";
      return `Worn on the ${w.hand ?? "left"} ${w.finger ?? "ring"} finger, seated at the base of the finger in full contact with the skin${w.stack_position && w.stack_position > 1 ? `, stacked in position ${w.stack_position}` : ""}.${scale}`;
    }
    case "necklace": {
      const len = spec.chain?.length_in ?? 18;
      return `Worn around the neck, ${chainLandmark(len).label}; the pendant or focal point hangs centered and the chain follows the collarbones.`;
    }
    case "earring": {
      const side = w.ear_side ?? "both";
      return `Worn ${side === "both" ? "as a matching pair, one in each ear" : `in the ${side} ear`}, passing through the lobe; hair kept clear of the ear.`;
    }
    case "bracelet":
      return "Worn on the wrist, resting naturally against the skin with a relaxed hand; clasp at the inside or back of the wrist.";
    case "anklet":
      return "Worn on the ankle, resting on the ankle bone.";
    case "brooch":
      return "Pinned to the lapel or collar of the garment, lying flat against the fabric.";
    case "watch":
      return "Worn on the wrist with the dial facing the camera, hands at 10:10.";
    case "cufflink":
      return "Worn through a French cuff with the jacket sleeve pushed slightly back.";
    case "body_jewelry":
      return "Worn in its piercing, seated flush against the skin.";
    default:
      return "";
  }
}

/** Derive fidelity invariants: short imperative facts that must hold in every render. */
export function deriveInvariants(specIn: ProductSpec): string[] {
  const spec = normalizeProductSpec(specIn);
  const inv: string[] = [];
  const settings = [spec.setting, ...spec.stones.map((s) => s.setting)].filter((s): s is NonNullable<typeof s> => !!s);
  for (const s of settings) {
    if (s.type === "prong" && s.prong_count) inv.push(`exactly ${s.prong_count} prongs`);
    else inv.push(`${humanize(s.type).toLowerCase()} setting kept exactly as in the reference`);
  }
  const center = spec.stones.filter((s) => s.role === "center");
  const others = spec.stones.filter((s) => s.role !== "center");
  if (center.length === 1) inv.push(`one ${humanize(center[0].shape).toLowerCase()} ${humanize(center[0].type).toLowerCase()} center stone`);
  if (others.length === 0) inv.push(center.length ? "no accent or pavé stones beyond those described" : "no stones added");
  for (const o of others) inv.push(`${o.count ? o.count + " " : ""}${humanize(o.shape).toLowerCase()} ${humanize(o.type).toLowerCase()} ${o.role} stones, no more, no fewer`);
  const metal = spec.metal.type;
  if (WARM_METALS.has(metal)) inv.push(`${humanize(metal).toLowerCase()} color stays true (warm, not brassy or orange)`);
  if (WHITE_METALS.has(metal)) inv.push(`${humanize(metal).toLowerCase()} stays neutral white-silver with no warm cast`);
  inv.push(`${humanize(spec.metal.finish).toLowerCase()} metal finish`);
  if (spec.chain) {
    inv.push(`${spec.chain.style ? humanize(spec.chain.style).toLowerCase() + " " : ""}chain with uniform, unbroken links${spec.chain.length_in ? ` at ${spec.chain.length_in} in` : ""}`);
    if (spec.chain.clasp && spec.chain.clasp !== "none") inv.push(`${humanize(spec.chain.clasp).toLowerCase()} clasp`);
  }
  if (spec.category === "earring") inv.push("earrings are an identical pair");
  if (spec.dimensions?.band_width_mm) inv.push(`band ${spec.dimensions.band_width_mm} mm wide`);
  if (spec.hallmarks.length === 0) inv.push("no engraving, hallmark, text or logo visible on the piece");
  else inv.push(`hallmarks read exactly: ${spec.hallmarks.join(", ")}`);
  if (spec.stones.some((s) => STEP_CUTS.has(s.shape))) inv.push("step-cut facets stay crisp and rectilinear");
  if (spec.stones.some((s) => OPAQUE_STONES.has(s.type) || s.type === "pearl")) inv.push("opaque stones keep their true color and soft luster, no faceting added");
  inv.push("product matches the reference images exactly; no redesign");
  return Array.from(new Set(inv));
}

/** Material facts used by the lighting rules (§11). */
export function materialProfile(spec: ProductSpec) {
  const stones = spec.stones;
  return {
    hasDiamond: stones.some((s) => ["diamond", "lab_diamond", "moissanite", "cubic_zirconia"].includes(s.type)),
    hasStepCut: stones.some((s) => STEP_CUTS.has(s.shape)),
    hasColoredTransparent: stones.some((s) => !["diamond", "lab_diamond", "moissanite", "cubic_zirconia"].includes(s.type) && !OPAQUE_STONES.has(s.type) && s.type !== "pearl"),
    hasOpaque: stones.some((s) => OPAQUE_STONES.has(s.type) || s.type === "pearl" || s.cut === "cabochon"),
    hasPearl: stones.some((s) => s.type === "pearl"),
    warmMetal: WARM_METALS.has(spec.metal.type),
    whiteMetal: WHITE_METALS.has(spec.metal.type),
    enamel: spec.metal.type === "enamel",
    highPolish: spec.metal.finish === "high_polish",
  };
}
