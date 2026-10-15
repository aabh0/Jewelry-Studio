import type { HandlerSpec } from "@/queue/types";
import { PermanentError } from "@/queue/types";
import { env } from "@/env";
import { callStructured, craftGuidance, ClaudeError } from "@/providers/claude/client";
import { zShotList, zStoryboard, zCritique, zTalentExpansion, zCampaignBrief, zShotSpec, type Storyboard } from "@/domain/storyboard";
import { getCampaign, replaceShots, updateCampaign, getCandidate, createShot } from "@/server/campaigns";
import { getProduct, productReferenceSet } from "@/server/products";
import { getTalent, updateTalent, talentReferenceSet } from "@/server/talent";
import { assetAbs } from "@/server/assets";
import { describeProduct } from "@/domain/product";
import { describeTalent } from "@/domain/talent";
import { mockShotList } from "@/providers/mock";
import { lightingFromPreset } from "@/domain/lighting";
import { newId } from "@/lib/ids";
import { CHANNELS } from "@/domain/delivery";

function campaignContext(db: import("@/db/client").DB, campaignId: string) {
  const c = getCampaign(db, campaignId);
  const products = c.productIds.map((id) => getProduct(db, id));
  const talents = c.talent.map((t) => ({ t: getTalent(db, t.talentId), outfitId: t.outfitId }));
  const lines: string[] = [];
  lines.push(`CAMPAIGN BRIEF (JSON): ${JSON.stringify(c.brief)}`);
  lines.push(`CAMPAIGN KIND: ${c.kind}. DEFAULT ASPECT: ${c.settings.default_aspect}. LIGHTING PRESET: ${c.settings.lighting_preset}.`);
  lines.push(`CHANNELS AVAILABLE: ${CHANNELS.map((ch) => ch.id).join(", ")}.`);
  lines.push("PRODUCTS (use these ids exactly):");
  for (const p of products) lines.push(`- id=${p.id} name="${p.name}": ${describeProduct(p.spec)} Invariants: ${p.invariants.join("; ")}.`);
  if (talents.length) {
    lines.push("TALENT (use these ids exactly):");
    for (const { t, outfitId } of talents) {
      const o = t.outfits.find((x) => x.id === outfitId);
      lines.push(`- id=${t.id} name="${t.name}": ${describeTalent(t.spec)}${o ? ` Outfit id=${o.id}: ${o.spec.description} (${o.spec.neckline} neckline, ${o.spec.fabric_finish})` : ""}. Other outfit ids: ${t.outfits.map((x) => x.id).join(", ") || "none"}.`);
    }
  } else lines.push("TALENT: none. Do not include talent_id in shots; use product-only formats or hands-only hand_model shots without an identity.");
  if (c.refs.length) lines.push(`STYLE REFERENCES: ${c.refs.length} images attached (roles: ${c.refs.map((r) => r.role).join(", ")}).`);
  const images: { path: string; label: string }[] = [];
  for (const p of products) for (const r of productReferenceSet(p, 2)) images.push({ path: assetAbs(r.asset), label: `Product ${p.name} (${r.role})` });
  for (const { t } of talents) for (const r of talentReferenceSet(t, undefined, 1)) images.push({ path: assetAbs(r.asset), label: `Talent ${t.name}` });
  for (const r of c.refs.slice(0, 3)) if (r.asset.kind === "image") images.push({ path: assetAbs(r.asset), label: `Style reference (${r.role})` });
  return { c, products, talents, text: lines.join("\n"), images };
}

export const directorShotList: HandlerSpec<{ campaign_id: string; count?: number }> = {
  lane: "claude",
  maxAttempts: 2,
  run: async (ctx) => {
    const { c, products, talents, text, images } = campaignContext(ctx.db, ctx.payload.campaign_id);
    if (products.length === 0) throw new PermanentError("Add at least one product to the campaign before planning shots.");
    const count = ctx.payload.count ?? c.brief.deliverables.stills ?? 8;
    updateCampaign(ctx.db, c.id, { status: "planning" });
    let list;
    if (env.MOCK_PROVIDERS) {
      list = zShotList.parse(mockShotList({ products: products.map((p) => ({ id: p.id, name: p.name })), talent: talents.map((x) => ({ id: x.t.id })), stills: count }));
    } else {
      ctx.progress(10, "Asking the creative director for a shot list");
      const task = `${text}\n\nTASK: Produce a shot list of ${count} stills for this campaign. Spread formats across hero, macro, on-model and lifestyle as the brief implies; every shot must cite product ids from the list; set aspect per channel (4:5 feed, 9:16 story, 1:1 catalog, 16:9 web); use the lighting vocabulary fields precisely; fill camera lens/aperture/angle/shot_size; keep purposes one sentence. Return JSON matching the ShotList schema.`;
      const res = await callStructured({ purpose: "shot_list", model: env.CLAUDE_DIRECTOR_MODEL, effort: "high", maxTokens: 16000, system: craftGuidance(), task, images, schema: zShotList, db: ctx.db });
      list = res.data;
      ctx.emit("cost", { actual_usd: res.costUsd });
    }
    const validIds = new Set(products.map((p) => p.id));
    const validTalent = new Set(talents.map((x) => x.t.id));
    const items = list.shots.map((s) => {
      const pids = s.product_ids.filter((id) => validIds.has(id));
      if (pids.length === 0) throw new PermanentError(`The director referenced an unknown product id in "${s.title}". Raw output saved in claude_runs.`);
      const lighting = { ...lightingFromPreset(c.settings.lighting_preset), ...s.lighting };
      const spec = zShotSpec.parse({ ...s, product_ids: pids, talent_id: s.talent_id && validTalent.has(s.talent_id) ? s.talent_id : undefined, lighting, variants: s.variants ?? c.settings.variants_per_shot, channels: s.channels.length ? s.channels : c.brief.channels });
      return { title: s.title, spec };
    });
    replaceShots(ctx.db, c.id, items);
    updateCampaign(ctx.db, c.id, { status: "shots_pending_approval" });
    return { shots: items.length, rationale: list.rationale, open_questions: list.open_questions };
  },
};

export const directorStoryboard: HandlerSpec<{ campaign_id: string }> = {
  lane: "claude",
  maxAttempts: 2,
  run: async (ctx) => {
    const { c, products, talents, text, images } = campaignContext(ctx.db, ctx.payload.campaign_id);
    if (products.length === 0) throw new PermanentError("Add at least one product to the campaign before storyboarding.");
    const target = c.brief.deliverables.videos?.[0]?.duration_s ?? 15;
    updateCampaign(ctx.db, c.id, { status: "planning" });
    let sb: Storyboard;
    if (env.MOCK_PROVIDERS) {
      const n = Math.max(3, Math.min(6, Math.round(target / 3)));
      const moves = ["macro_push_in", "slow_orbit_cw", "hand_gesture_reveal", "light_sweep", "pull_out_reveal", "rack_focus_stone_to_face"] as const;
      sb = zStoryboard.parse({
        title: `${c.name} — mock storyboard`, duration_s: target, structure: target <= 6 ? "reveal_6s" : target <= 10 ? "detail_10s" : "lifestyle_15s", aspect: c.settings.default_aspect === "9:16" ? "9:16" : c.settings.default_aspect === "16:9" ? "16:9" : "9:16",
        music: { mood: "soft cinematic piano", source: "owner_upload" }, end_card: { copy: products[0].name, duration_s: 1.5 },
        shots: Array.from({ length: n }, (_, i) => ({
          id: newId(), order: i, title: `Shot ${i + 1}`, duration_s: Math.max(2, Math.min(8, Math.round((target - 1.5) / n))), shot_size: i === 0 ? "ECU" : "CU", angle: "three_quarter_45", camera_move: moves[i % moves.length], move_speed: "slow", lens_mm: 100, aperture: "f4", focus: "product",
          lighting: lightingFromPreset(c.settings.lighting_preset), scene: { environment: "", props: [] }, subject_action: "the piece turns slowly to catch the light", product_placement: { product_id: products[0].id, visibility: "full" },
          talent_id: i === 2 && talents[0] ? talents[0].t.id : undefined, invariants: products[0].invariants.slice(0, 3), transition_in: i === 0 ? "cut" : "dissolve", transition_out: "cut", audio_cue: "music", continuous_with_next: false,
          keyframe_prompt_hint: "", video_prompt_hint: "", qa_flags: ["prong_count"], format: i === 2 && talents[0] ? "on_model_beauty_crop" : "hero_still_life",
        })),
      });
    } else {
      ctx.progress(10, "Asking the creative director for a storyboard");
      const task = `${text}\n\nTASK: Write a ${target}-second storyboard for a ${c.settings.default_aspect} video. Choose the structure, 3–8 shots of 2–8 s each summing to ${target - 1.5} s plus a 1.5 s end card, one camera move per shot, product visible in every shot unless a deliberate reveal, lighting static per shot, sparkle no higher than medium. Give each shot a unique id (short slug), keyframe_prompt_hint (what the still should show) and video_prompt_hint (motion). Use product/talent ids exactly. Return JSON matching the Storyboard schema.`;
      const res = await callStructured({ purpose: "storyboard", model: env.CLAUDE_DIRECTOR_MODEL, effort: "high", maxTokens: 16000, system: craftGuidance(), task, images, schema: zStoryboard, db: ctx.db });
      sb = res.data;
      ctx.emit("cost", { actual_usd: res.costUsd });
    }
    const validIds = new Set(products.map((p) => p.id));
    const validTalent = new Set(talents.map((x) => x.t.id));
    sb.shots = sb.shots.map((s, i) => ({ ...s, id: s.id || newId(), order: i, product_placement: { ...s.product_placement, product_id: validIds.has(s.product_placement.product_id) ? s.product_placement.product_id : products[0].id }, talent_id: s.talent_id && validTalent.has(s.talent_id) ? s.talent_id : undefined }));
    updateCampaign(ctx.db, c.id, { storyboard: sb, status: "shots_pending_approval" });
    // Create one shot row per storyboard shot (keyframes are generated from these).
    const items = sb.shots.map((s) => ({
      title: s.title,
      spec: zShotSpec.parse({
        format: s.format ?? (s.talent_id ? "on_model_beauty_crop" : "hero_still_life"), crop: s.product_placement.crop, purpose: s.keyframe_prompt_hint || s.subject_action, product_ids: [s.product_placement.product_id], talent_id: s.talent_id, outfit_id: s.outfit_id,
        lighting: s.lighting, scene: s.scene, camera: { lens_mm: s.lens_mm, aperture: s.aperture, angle: s.angle, shot_size: s.shot_size, focus: s.focus }, aspect: sb.aspect,
        free_text: s.keyframe_prompt_hint || undefined, variants: c.settings.keyframe_variants, channels: c.brief.channels, priority: 2, qa_focus: [],
        duration_s: s.duration_s, camera_move: s.camera_move, move_speed: s.move_speed, subject_action: s.subject_action, product_visibility: s.product_placement.visibility, transition_in: s.transition_in, transition_out: s.transition_out, audio_cue: s.audio_cue, text_overlay: s.text_overlay, continuous_with_next: s.continuous_with_next, keyframe_prompt_hint: s.keyframe_prompt_hint, video_prompt_hint: s.video_prompt_hint,
      }),
    }));
    // keep storyboard ids aligned with shot ids
    const existing = getCampaign(ctx.db, c.id).shots;
    const kept = existing.filter((s) => s.stats.length > 0);
    for (const s of existing) if (!kept.some((k) => k.id === s.id)) { const { deleteShot } = await import("@/server/campaigns"); deleteShot(ctx.db, s.id); }
    sb.shots.forEach((s, i) => {
      const row = createShot(ctx.db, c.id, items[i].title, items[i].spec, kept.length + i);
      s.id = row.id;
    });
    updateCampaign(ctx.db, c.id, { storyboard: sb });
    return { shots: sb.shots.length, duration_s: sb.duration_s };
  },
};

export const directorTalentExpand: HandlerSpec<{ talent_id: string }> = {
  lane: "claude",
  maxAttempts: 2,
  run: async (ctx) => {
    const t = getTalent(ctx.db, ctx.payload.talent_id);
    if (env.MOCK_PROVIDERS) {
      updateTalent(ctx.db, t.id, { spec: { ...t.spec, face_notes: t.spec.face_notes || "oval face with a defined jawline and high cheekbones, straight nose, full lips with a natural rosy tint, almond eyes, naturally muted catchlights", body: t.spec.body || "slender with balanced proportions" } });
      return { mock: true };
    }
    const task = `Brief for an original campaign model named ${t.name}: ${t.spec.brief || "(none)"}\nStructured fields: ${JSON.stringify({ ...t.spec, brief: undefined })}\n\nTASK: Write the slots for a character sheet: face_notes (face shape, jaw, cheekbones, nose, lips with finish, eyes with muted catchlights; mature adult structure), body (one phrase), hair_color (specific tone), heritage_notes (respectful, optional), style_sentence (one line summarizing their look for a jewelry campaign). Original character only. Return JSON.`;
    const res = await callStructured({ purpose: "talent_expand", model: env.CLAUDE_DIRECTOR_MODEL, effort: "medium", maxTokens: 2000, system: craftGuidance(), task, schema: zTalentExpansion, db: ctx.db });
    updateTalent(ctx.db, t.id, { spec: { ...t.spec, face_notes: res.data.face_notes, body: res.data.body, hair: { ...t.spec.hair, color: res.data.hair_color }, heritage_notes: res.data.heritage_notes ?? t.spec.heritage_notes } });
    ctx.emit("cost", { actual_usd: res.costUsd });
    return { ok: true };
  },
};

export const directorCritique: HandlerSpec<{ candidate_id: string; question?: string }> = {
  lane: "claude",
  maxAttempts: 1,
  run: async (ctx) => {
    const cand = getCandidate(ctx.db, ctx.payload.candidate_id);
    if (env.MOCK_PROVIDERS) return { issues: [{ kind: "lighting_mismatch", where: "left edge", fix_prompt: "Add a stronger rim light on the left edge of the band." }], summary: "Mock critique." };
    const task = `${ctx.payload.question ?? "Why does this candidate look off, and what single change would fix it?"}\nProduct invariants: ${JSON.stringify(cand.generation)}\nReturn JSON with issues[{kind, where, fix_prompt}] and a one-paragraph summary.`;
    const res = await callStructured({ purpose: "critique", model: env.CLAUDE_QA_MODEL, effort: "low", maxTokens: 2000, system: craftGuidance(), task, images: [{ path: assetAbs(cand.asset), label: "Candidate", maxEdge: 1568 }], schema: zCritique, db: ctx.db });
    ctx.emit("cost", { actual_usd: res.costUsd });
    return res.data;
  },
};

export const directorBriefParse: HandlerSpec<{ campaign_id: string; text: string }> = {
  lane: "claude",
  maxAttempts: 1,
  run: async (ctx) => {
    const c = getCampaign(ctx.db, ctx.payload.campaign_id);
    if (env.MOCK_PROVIDERS) {
      updateCampaign(ctx.db, c.id, { brief: { ...c.brief, goal: ctx.payload.text.slice(0, 200) } });
      return { mock: true };
    }
    try {
      const res = await callStructured({ purpose: "brief_parse", model: env.CLAUDE_DIRECTOR_MODEL, effort: "medium", maxTokens: 3000, system: craftGuidance(), task: `Parse this client brief into the CampaignBrief JSON schema (goal, channels from the available ids ${CHANNELS.map((x) => x.id).join(", ")}, tone, must_include, must_avoid, occasion, deliverables). Brief:\n\n${ctx.payload.text}`, schema: zCampaignBrief, db: ctx.db });
      updateCampaign(ctx.db, c.id, { brief: res.data });
      ctx.emit("cost", { actual_usd: res.costUsd });
      return res.data;
    } catch (err) {
      if (err instanceof ClaudeError) throw new PermanentError(err.message, err.code);
      throw err;
    }
  },
};
