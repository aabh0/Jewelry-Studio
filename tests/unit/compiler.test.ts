import { describe, it, expect } from "vitest";
import { compilePrompt, compileRefine, compileCharacterSheet, compileVideoPrompt, compileCleanPlate } from "@/domain/prompt/compile";
import { zProductSpec, deriveInvariants } from "@/domain/product";
import { zShotSpec, zStoryboardShot } from "@/domain/storyboard";
import { zTalentSpec } from "@/domain/talent";

const spec = zProductSpec.parse({ category: "ring", subtype: "solitaire", metal: { type: "yellow_gold", karat: 18, finish: "high_polish" }, stones: [{ role: "center", type: "diamond", shape: "oval", carat: 1 }], setting: { type: "prong", prong_count: 4 } });
const product = { id: "p1", name: "Aurora", spec, invariants: deriveInvariants(spec) };

describe("prompt compiler", () => {
  it("builds ordered sections and ends with resolution for GPT models", () => {
    const shot = zShotSpec.parse({ format: "hero_still_life", aspect: "4:5", purpose: "hero" });
    const b = compilePrompt({ shot, products: [product], references: [{ asset_id: "a", role: "product_primary" }, { asset_id: "b", role: "product_angle" }], target: { model: "marketing-studio/image/flare", lane: "cloud", resolution: "2k" } });
    expect(b.prompt_text.endsWith("resolution: 2k")).toBe(true);
    const i = (k: string) => b.prompt_text.indexOf(k);
    expect(i("[PRODUCT")).toBeLessThan(i("[LIGHTING]"));
    expect(i("[LIGHTING]")).toBeLessThan(i("[AVOID]"));
    expect(b.prompt_text).toMatch(/exactly 4 prongs/);
    expect(b.prompt_text).toMatch(/Image 1 is the authoritative product/);
    expect(b.prompt_text).toMatch(/Create a polished commercial still/); // hero master prompt
  });
  it("is deterministic", () => {
    const shot = zShotSpec.parse({ format: "macro_detail", aspect: "1:1" });
    const a = compilePrompt({ shot, products: [product], references: [], target: { model: "gpt_image_2_5", lane: "cli", resolution: "2k" } });
    const b = compilePrompt({ shot, products: [product], references: [], target: { model: "gpt_image_2_5", lane: "cli", resolution: "2k" } });
    expect(a.prompt_text).toBe(b.prompt_text);
  });
  it("adds talent and anti-uncanny negatives", () => {
    const shot = zShotSpec.parse({ format: "on_model_beauty_crop", crop: "hand", aspect: "4:5" });
    const t = zTalentSpec.parse({ hair: {}, hands: { nails: "nude" } });
    const b = compilePrompt({ shot, products: [product], talent: { id: "t", name: "Mara", spec: t }, references: [{ asset_id: "x", role: "talent_identity" }], target: { model: "marketing-studio/image/flare", lane: "cloud", resolution: "2k" } });
    expect(b.sections.TALENT).toMatch(/Identical original character/);
    expect(b.negative_text).toMatch(/uncanny/);
    expect(b.prompt_text).toMatch(/nude nails/);
  });
  it("prompt override replaces body", () => {
    const shot = zShotSpec.parse({ format: "flat_lay", aspect: "1:1", prompt_override: "custom text" });
    const b = compilePrompt({ shot, products: [product], references: [], target: { model: "alibaba/qwen-image-3/edit", lane: "cloud", resolution: "2k" } });
    expect(b.prompt_text.startsWith("custom text")).toBe(true);
  });
  it("refine, plate, sheet, video prompts", () => {
    expect(compileRefine("warm the gold", product)).toMatch(/IDENTICAL/);
    expect(compileCleanPlate("macro", product)).toMatch(/top-down macro/);
    expect(compileCharacterSheet("split", zTalentSpec.parse({ hair: {} }), "Mara")).toMatch(/Split-screen/);
    const vs = zStoryboardShot.parse({ id: "s1", order: 0, title: "t", duration_s: 4, shot_size: "CU", angle: "eye_level", camera_move: "slow_orbit_cw", lighting: {}, scene: {}, subject_action: "ring rotates", product_placement: { product_id: "p1" }, keyframe_prompt_hint: "", video_prompt_hint: "" });
    const v = compileVideoPrompt(vs, product);
    expect(v).toMatch(/4-second/);
    expect(v).toMatch(/in every frame/);
    expect(v.length).toBeLessThanOrEqual(1400);
  });
});
