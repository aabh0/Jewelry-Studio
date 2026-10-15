import { describe, it, expect } from "vitest";
import { zProductSpec, normalizeProductSpec, deriveInvariants, describeProduct, describeWear, validateProductSpec } from "@/domain/product";
import { roundCaratToMm, chainLandmark, stoneMm } from "@/domain/sizes";
import { applyMaterialRules, describeLighting, zLightingSpec, lightingFromPreset } from "@/domain/lighting";
import { nearestAspect, channelById } from "@/domain/delivery";

const ring = zProductSpec.parse({
  category: "ring",
  subtype: "solitaire",
  metal: { type: "yellow_gold", karat: 18, finish: "high_polish" },
  stones: [{ role: "center", type: "diamond", shape: "oval", carat: 1.5 }],
  setting: { type: "prong", prong_count: 4 },
  dimensions: { band_width_mm: 2 },
});

describe("sizes", () => {
  it("interpolates carat to mm", () => {
    expect(roundCaratToMm(1)).toBe(6.5);
    expect(roundCaratToMm(0.75)).toBe(5.8);
    expect(roundCaratToMm(1.25)).toBeGreaterThan(6.5);
    expect(roundCaratToMm(1.25)).toBeLessThan(7.4);
  });
  it("maps chain length to landmark", () => {
    expect(chainLandmark(18).landmark).toBe("collarbone");
    expect(chainLandmark(16).landmark).toBe("base_of_throat");
    expect(chainLandmark(30).landmark).toBe("mid_chest");
  });
  it("oval stones are longer", () => {
    const [l, w] = stoneMm("oval", 1);
    expect(l).toBeGreaterThan(w);
  });
});

describe("product", () => {
  it("normalizes mm from carat and wear defaults", () => {
    const n = normalizeProductSpec(ring);
    expect(n.stones[0].mm?.[0]).toBeGreaterThan(8);
    expect(n.wear?.finger).toBe("ring");
    expect(n.wear?.hand).toBe("left");
  });
  it("derives invariants with prong count and metal", () => {
    const inv = deriveInvariants(ring);
    expect(inv).toContain("exactly 4 prongs");
    expect(inv.some((i) => i.includes("yellow gold"))).toBe(true);
    expect(inv.some((i) => i.includes("no accent"))).toBe(true);
  });
  it("describes product and wear", () => {
    const d = describeProduct(ring);
    expect(d).toMatch(/18k yellow gold/);
    expect(d).toMatch(/4-prong/);
    expect(describeWear(ring)).toMatch(/left ring finger/);
  });
  it("requires prong count", () => {
    const bad = zProductSpec.parse({ category: "ring", metal: { type: "platinum", finish: "high_polish" }, stones: [], setting: { type: "prong" } });
    expect(validateProductSpec(bad).errors.length).toBe(1);
  });
  it("necklace gets chain default and landmark", () => {
    const n = normalizeProductSpec(zProductSpec.parse({ category: "necklace", subtype: "pendant", metal: { type: "white_gold", finish: "high_polish" }, stones: [] }));
    expect(n.chain?.length_in).toBe(18);
    expect(n.wear?.sits_at).toBe("collarbone");
    expect(describeWear(n)).toMatch(/collarbone/);
  });
});

describe("lighting", () => {
  it("applies diamond and white-metal rules", () => {
    const base = zLightingSpec.parse({ sparkle: "none", negative_fill: "none", color_temp_k: 3200 });
    const white = zProductSpec.parse({ category: "ring", metal: { type: "platinum", finish: "high_polish" }, stones: [{ role: "center", type: "diamond", shape: "round_brilliant" }], setting: { type: "bezel" } });
    const { lighting, notes } = applyMaterialRules(base, white);
    expect(lighting.sparkle).toBe("medium");
    expect(lighting.negative_fill).not.toBe("none");
    expect(lighting.color_temp_k).toBeGreaterThanOrEqual(5000);
    expect(notes.length).toBeGreaterThan(0);
  });
  it("caps sparkle for video and pearls", () => {
    const base = lightingFromPreset("black_velvet_luxury");
    const pearl = zProductSpec.parse({ category: "necklace", metal: { type: "yellow_gold", finish: "high_polish" }, stones: [{ role: "strand", type: "pearl", shape: "bead", cut: "bead" }] });
    const { lighting } = applyMaterialRules(base, pearl, { video: true });
    expect(["none", "low"]).toContain(lighting.sparkle);
    expect(describeLighting(lighting, { video: true })).toMatch(/no flicker/);
  });
  it("describes lighting with Kelvin", () => {
    expect(describeLighting(lightingFromPreset("clean_studio"))).toMatch(/5500K/);
  });
});

describe("delivery", () => {
  it("finds nearest aspect", () => {
    expect(nearestAspect("4:5", ["1:1", "3:4", "16:9"])).toBe("3:4");
    expect(nearestAspect("9:16", ["16:9", "9:16"])).toBe("9:16");
    expect(channelById("ig_reels")?.height).toBe(1920);
  });
});
