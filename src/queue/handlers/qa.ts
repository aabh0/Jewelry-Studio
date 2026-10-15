import path from "node:path";
import { eq } from "drizzle-orm";
import type { HandlerSpec } from "@/queue/types";
import { env } from "@/env";
import { candidates } from "@/db/schema";
import { callStructured, craftGuidance, ClaudeError } from "@/providers/claude/client";
import { zQABatch, type QAResult } from "@/domain/storyboard";
import { getCandidate, loadShotContext } from "@/server/campaigns";
import { productReferenceSet } from "@/server/products";
import { talentReferenceSet } from "@/server/talent";
import { assetAbs, getAsset } from "@/server/assets";
import { centerHueSat } from "@/providers/local/sharp";
import { contactSheet } from "@/providers/local/ffmpeg";
import { dirs } from "@/lib/files";
import fs from "node:fs/promises";

function mockQa(index: number, seed: string): QAResult {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const score = 5 + (h % 50) / 10;
  const kinds = ["prong_count", "metal_color", "hands", "composition", "blur"] as const;
  const defects = score < 7 ? [{ kind: kinds[h % kinds.length], where: "center", severity: (h % 2 ? "major" : "minor") as "major" | "minor", fix_prompt: "Refine the previous image; correct the flagged detail." }] : [];
  return { candidate_index: index, score: +score.toFixed(1), product_fidelity: +Math.min(10, score + 0.5).toFixed(1), brief_adherence: +Math.max(0, score - 0.5).toFixed(1), technical: +score.toFixed(1), defects, verdict: score >= 7 ? "pass" : score >= 5 ? "review" : "retry", one_line: score >= 7 ? "Clean, product reads true." : "Needs a refinement pass." };
}

export const qaImage: HandlerSpec<{ candidate_ids: string[]; shot_id?: string }> = {
  lane: "claude",
  maxAttempts: 1,
  run: async (ctx) => {
    const cands = ctx.payload.candidate_ids.map((id) => getCandidate(ctx.db, id));
    if (cands.length === 0) return { scored: 0 };
    const shotId = ctx.payload.shot_id ?? cands[0].shotId!;
    const sc = loadShotContext(ctx.db, shotId);
    const product = sc.products[0];
    const plate = product ? productReferenceSet(product, 1)[0]?.asset : undefined;
    const local: Record<string, { metal_hue_delta?: number; flags: string[] }> = {};
    // local checks: metal hue vs plate (packshot/hero only)
    if (plate && ["packshot_white", "hero_still_life", "macro_detail", "flat_lay"].includes(sc.shot.spec.format)) {
      try {
        const ref = await centerHueSat(assetAbs(plate));
        for (const c of cands) {
          const h = await centerHueSat(assetAbs(c.asset));
          const delta = Math.abs(((h.hue - ref.hue + 540) % 360) - 180);
          const warm = ["yellow_gold", "rose_gold", "vermeil", "gold_plated", "gold_filled"].includes(product.spec.metal.type);
          const flags: string[] = [];
          if (warm && ref.sat > 0.1 && delta > 12) flags.push("metal_color");
          if (!warm && h.sat > 0.12) flags.push("metal_color");
          local[c.id] = { metal_hue_delta: +delta.toFixed(1), flags };
        }
      } catch { /* ignore */ }
    }
    let results: QAResult[];
    if (env.MOCK_PROVIDERS) {
      results = cands.map((c, i) => mockQa(i, c.id));
    } else {
      const images: { path: string; label: string; maxEdge?: number }[] = [];
      if (plate) images.push({ path: assetAbs(plate), label: "Reference product (authoritative)", maxEdge: 1092 });
      if (product) for (const r of productReferenceSet(product, 3).slice(1)) images.push({ path: assetAbs(r.asset), label: `Reference product (${r.role})` });
      if (sc.talent) for (const r of talentReferenceSet(sc.talent, undefined, 1)) images.push({ path: assetAbs(r.asset), label: `Talent identity reference (${sc.talent.name})` });
      const maxEdge = sc.shot.spec.format === "macro_detail" ? 1568 : 1092;
      cands.forEach((c, i) => images.push({ path: assetAbs(c.asset), label: `Candidate ${i + 1}`, maxEdge }));
      const task = `Score each candidate against the reference product and the shot purpose.\nShot purpose: ${sc.shot.spec.purpose || sc.shot.title}. Format: ${sc.shot.spec.format}${sc.shot.spec.crop ? ` (${sc.shot.spec.crop})` : ""}.\nProduct invariants: ${product ? product.invariants.join("; ") : "n/a"}.\nQA focus: ${sc.shot.spec.qa_focus.join(", ") || "general"}.${sc.talent ? ` Talent identity must match the identity reference (score identity_consistency).` : ""}\nCheck at detail level: prong count, stone count/shape/color, metal color (warm gold vs white metal), chain link continuity, clasp, placement on the body, scale, contact with skin, hands (five fingers, plausible joints), text artifacts, lighting consistency, plastic sheen, blur, composition.\nReturn JSON {results:[QAResult per candidate in order, candidate_index 0-based]}. Score 0–10 overall; verdict pass (≥7, no major defects), retry (<5 or a major product defect), review otherwise. fix_prompt must be one concrete refinement instruction.`;
      try {
        const res = await callStructured({ purpose: "qa", model: env.CLAUDE_QA_MODEL, effort: "low", maxTokens: 4000, system: craftGuidance(), task, images, schema: zQABatch, db: ctx.db });
        results = res.data.results;
        ctx.emit("cost", { actual_usd: res.costUsd });
      } catch (err) {
        if (err instanceof ClaudeError && (err.code === "refusal" || err.code === "missing_key")) {
          results = cands.map((_, i) => ({ candidate_index: i, score: 5, product_fidelity: 5, brief_adherence: 5, technical: 5, defects: [], verdict: "review", one_line: err.code === "missing_key" ? "QA skipped: no Anthropic key." : "QA declined; review manually." }));
        } else throw err;
      }
    }
    let scored = 0;
    for (const c of cands) {
      const idx = cands.indexOf(c);
      const r = results.find((x) => x.candidate_index === idx) ?? results[idx];
      if (!r) continue;
      const l = local[c.id];
      if (l?.flags.length) for (const f of l.flags) if (!r.defects.some((d) => d.kind === f)) r.defects.push({ kind: f as QAResult["defects"][number]["kind"], where: "product metal", severity: "minor", fix_prompt: "Correct the metal color to match the reference: warm gold stays warm, white metals stay neutral." });
      const qa = { ...r, local: l ?? null };
      ctx.db.update(candidates).set({ qaJson: JSON.stringify(qa), qaScore: r.score }).where(eq(candidates.id, c.id)).run();
      scored++;
      ctx.emit("artifact", { candidate_id: c.id, qa_score: r.score, verdict: r.verdict });
    }
    return { scored };
  },
};

export const qaVideo: HandlerSpec<{ candidate_ids: string[]; shot_id?: string }> = {
  lane: "claude",
  maxAttempts: 1,
  run: async (ctx) => {
    const cands = ctx.payload.candidate_ids.map((id) => getCandidate(ctx.db, id));
    if (cands.length === 0) return { scored: 0 };
    const shotId = ctx.payload.shot_id ?? cands[0].shotId!;
    const sc = loadShotContext(ctx.db, shotId);
    const product = sc.products[0];
    const plate = product ? productReferenceSet(product, 1)[0]?.asset : undefined;
    const sheets: string[] = [];
    await fs.mkdir(dirs.tmp(), { recursive: true });
    for (const c of cands) {
      const dest = path.join(dirs.tmp(), `qa-${c.id}.jpg`);
      try { await contactSheet(assetAbs(c.asset), dest, 3, 2, 480); sheets.push(dest); } catch { sheets.push(""); }
    }
    let results: QAResult[];
    if (env.MOCK_PROVIDERS) results = cands.map((c, i) => mockQa(i, c.id + "v"));
    else {
      const images: { path: string; label: string; maxEdge?: number }[] = [];
      if (plate) images.push({ path: assetAbs(plate), label: "Reference product (authoritative)" });
      const kf = sc.shot.keyframeAssetId ? getAsset(ctx.db, sc.shot.keyframeAssetId) : null;
      if (kf) images.push({ path: assetAbs(kf), label: "Approved keyframe (start frame)" });
      cands.forEach((c, i) => { if (sheets[i]) images.push({ path: sheets[i], label: `Candidate clip ${i + 1}: 6 frames sampled 1 s apart, left to right, top to bottom`, maxEdge: 1568 }); });
      const task = `Each candidate is a contact sheet of 6 frames from a ${sc.shot.spec.duration_s ?? 5}s clip. Judge temporal consistency of the product across frames (prong count, stone shape, chain geometry, metal color), morphing, sparkle flicker, motion plausibility, and whether the clip follows the direction: "${sc.shot.spec.subject_action ?? ""}" with camera move ${sc.shot.spec.camera_move ?? "unspecified"}. Product invariants: ${product ? product.invariants.join("; ") : "n/a"}. Return JSON {results:[QAResult per candidate in order]} using defect kinds temporal_consistency, morph, sparkle_flicker where relevant.`;
      try {
        const res = await callStructured({ purpose: "qa_video", model: env.CLAUDE_QA_MODEL, effort: "low", maxTokens: 4000, system: craftGuidance(), task, images, schema: zQABatch, db: ctx.db });
        results = res.data.results;
        ctx.emit("cost", { actual_usd: res.costUsd });
      } catch (err) {
        if (err instanceof ClaudeError) results = cands.map((_, i) => ({ candidate_index: i, score: 5, product_fidelity: 5, brief_adherence: 5, technical: 5, defects: [], verdict: "review", one_line: "QA unavailable; review manually." }));
        else throw err;
      }
    }
    for (const [i, c] of cands.entries()) {
      const r = results.find((x) => x.candidate_index === i) ?? results[i];
      if (!r) continue;
      ctx.db.update(candidates).set({ qaJson: JSON.stringify(r), qaScore: r.score }).where(eq(candidates.id, c.id)).run();
      ctx.emit("artifact", { candidate_id: c.id, qa_score: r.score, verdict: r.verdict });
    }
    for (const s of sheets) if (s) await fs.unlink(s).catch(() => {});
    return { scored: cands.length };
  },
};
