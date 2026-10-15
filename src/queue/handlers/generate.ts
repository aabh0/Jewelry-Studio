import path from "node:path";
import { eq } from "drizzle-orm";
import type { HandlerSpec } from "@/queue/types";
import { PermanentError } from "@/queue/types";
import { candidates, shots } from "@/db/schema";
import { newId } from "@/lib/ids";
import { runGeneration, projectOutDir } from "./common";
import { loadShotContext, updateShot } from "@/server/campaigns";
import { productReferenceSet } from "@/server/products";
import { talentReferenceSet } from "@/server/talent";
import { registerAsset, getAsset, assetAbs, type AssetRow } from "@/server/assets";
import { compilePrompt, compileVideoPrompt, compilePresetVideo, type ReferenceRole } from "@/domain/prompt/compile";
import { zStoryboardShot } from "@/domain/storyboard";
import { extractFrame } from "@/providers/local/ffmpeg";
import type { CapabilityId } from "@/providers/capability";

export interface GenImagePayload {
  shot_id: string;
  stage?: "stills" | "keyframes";
  variants?: number;
  capability?: CapabilityId;
  impl_id?: string;
  seed?: number;
  resolution?: "1k" | "2k" | "4k";
}

export function buildShotReferences(ctx: ReturnType<typeof loadShotContext>, maxRefs = 10): { refs: AssetRow[]; roles: ReferenceRole[] } {
  const refs: AssetRow[] = [];
  const roles: ReferenceRole[] = [];
  for (const p of ctx.products) {
    for (const r of productReferenceSet(p, ctx.products.length > 1 ? 3 : 5)) {
      refs.push(r.asset);
      roles.push({ asset_id: r.asset.id, role: r.role });
    }
  }
  if (ctx.talent) {
    for (const r of talentReferenceSet(ctx.talent, ctx.shot.spec.crop)) {
      refs.push(r.asset);
      roles.push({ asset_id: r.asset.id, role: r.role });
    }
    if (ctx.outfit?.refs[0]) { refs.push(ctx.outfit.refs[0]); roles.push({ asset_id: ctx.outfit.refs[0].id, role: "outfit" }); }
  }
  for (const r of ctx.campaign.refs.slice(0, 2)) {
    if (r.asset.kind !== "image") continue;
    refs.push(r.asset);
    roles.push({ asset_id: r.asset.id, role: r.role === "composition" ? "composition" : "style" });
  }
  return { refs: refs.slice(0, maxRefs), roles: roles.slice(0, maxRefs) };
}

/** Soul ID can only drive a talent still once a character has actually been trained. */
export function soulReady(t: { identityMode: string; soulId: string | null; soulStatus: string | null } | undefined): boolean {
  return !!t && t.identityMode === "soul_id" && !!t.soulId && t.soulStatus === "ready";
}

export const genImage: HandlerSpec<GenImagePayload> = {
  lane: "provider",
  maxAttempts: 2,
  run: async (ctx) => {
    const p = ctx.payload;
    const sc = loadShotContext(ctx.db, p.shot_id);
    const stage = p.stage ?? (sc.campaign.kind === "video" ? "keyframes" : "stills");
    const hasTalent = !!sc.talent;
    const capability: CapabilityId = p.capability ?? (hasTalent ? "image.generate.person" : "image.generate.product");
    const implId = p.impl_id ?? sc.campaign.settings.image_capability_override;
    const excludeImpls = soulReady(sc.talent) ? [] : ["cli.soul"];
    const { refs, roles } = buildShotReferences(sc);
    const products = sc.products.map((pr) => ({ id: pr.id, name: pr.name, spec: pr.spec, invariants: pr.invariants, learnedAvoids: pr.learnedAvoids }));
    const resolution = p.resolution ?? sc.campaign.settings.resolution;
    const bundle = compilePrompt({
      shot: sc.shot.spec,
      products,
      talent: sc.talent ? { id: sc.talent.id, name: sc.talent.name, spec: sc.talent.spec, outfit: sc.outfit?.spec } : undefined,
      references: roles,
      target: { model: "marketing-studio/image/flare", lane: "cloud", resolution },
      brief: sc.campaign.brief,
    });
    updateShot(ctx.db, sc.shot.id, { compiledPrompt: bundle, status: "generating" });
    const variants = p.variants ?? (stage === "keyframes" ? sc.campaign.settings.keyframe_variants : sc.shot.spec.variants ?? sc.campaign.settings.variants_per_shot);
    const out = await runGeneration(ctx, {
      capability, implId, excludeImpls, kind: "image", prompt: bundle.prompt_text, negative: bundle.negative_text, refs,
      aspect: sc.shot.spec.aspect, resolution, count: variants, seed: p.seed,
      outDir: projectOutDir(sc.campaign.projectId, "shots", sc.shot.id, "candidates"), outBase: `${ctx.job.id}`,
      projectId: sc.campaign.projectId, campaignId: sc.campaign.id, shotId: sc.shot.id, stage, label: sc.shot.title,
    });
    const candidateIds: string[] = [];
    for (let i = 0; i < out.files.length; i++) {
      const a = await registerAsset(ctx.db, { projectId: sc.campaign.projectId, absFile: out.files[i], role: "candidate", kind: "image", sourceJobId: ctx.job.id, providerUrl: out.providerUrls[i], meta: { shot_id: sc.shot.id, stage, model: out.impl.model, lane: out.impl.lane, index: i, generation_id: out.generationId }, tags: [stage, sc.shot.spec.format] });
      const cid = newId();
      ctx.db.insert(candidates).values({ id: cid, generationId: out.generationId, shotId: sc.shot.id, stage, assetId: a.id, index: i, review: "unreviewed", createdAt: Date.now() }).run();
      candidateIds.push(cid);
      ctx.emit("artifact", { asset_id: a.id, candidate_id: cid, shot_id: sc.shot.id, stage });
    }
    updateShot(ctx.db, sc.shot.id, { status: "review" });
    ctx.enqueueChild("qa.image", { candidate_ids: candidateIds, shot_id: sc.shot.id }, { label: `QA ${sc.shot.title}` });
    return { candidate_ids: candidateIds, generation_id: out.generationId, files: out.files.length };
  },
};

export interface GenVideoPayload {
  shot_id: string;
  variants?: number;
  capability?: CapabilityId;
  impl_id?: string;
  mode?: "auto" | "i2v" | "r2v" | "flf" | "preset";
  resolution?: string;
  seed?: number;
}

export const genVideo: HandlerSpec<GenVideoPayload> = {
  lane: "provider",
  maxAttempts: 2,
  run: async (ctx) => {
    const p = ctx.payload;
    const sc = loadShotContext(ctx.db, p.shot_id);
    const shot = sc.shot;
    if (!shot.keyframeAssetId) throw new PermanentError("This shot has no approved keyframe yet. Approve a keyframe first.", "no_keyframe");
    const keyframe = getAsset(ctx.db, shot.keyframeAssetId);
    const sb = sc.campaign.storyboard;
    const sbShot = sb?.shots.find((s) => s.id === shot.id) ?? sb?.shots[shot.order];
    const duration = shot.spec.duration_s ?? sbShot?.duration_s ?? 5;
    // Next shot's keyframe as end frame when continuous
    let endFrame: AssetRow | undefined;
    if (shot.spec.continuous_with_next) {
      const next = sc.campaign.shots.find((s) => s.order === shot.order + 1);
      if (next?.keyframeAssetId) endFrame = getAsset(ctx.db, next.keyframeAssetId);
    }
    const presetId = shot.spec.preset_move;
    let mode = p.mode ?? "auto";
    if (mode === "auto") mode = presetId ? "preset" : sc.talent || sc.products.length > 1 ? "r2v" : endFrame ? "flf" : "i2v";
    let prompt: string;
    const product = sc.products[0] ? { spec: sc.products[0].spec, invariants: sc.products[0].invariants } : undefined;
    if (mode === "preset" && presetId) {
      prompt = compilePresetVideo(presetId, Math.max(4, Math.min(duration, 10))) ?? "";
      if (!prompt) throw new PermanentError(`Unknown preset move ${presetId}`);
    } else {
      const sbs = zStoryboardShot.safeParse(sbShot ?? {});
      const fallback = zStoryboardShot.parse({
        id: shot.id, order: shot.order, title: shot.title, duration_s: Math.min(Math.max(duration, 2), 8), shot_size: shot.spec.camera.shot_size, angle: shot.spec.camera.angle,
        camera_move: shot.spec.camera_move ?? "slow_orbit_cw", move_speed: shot.spec.move_speed ?? "slow", lens_mm: shot.spec.camera.lens_mm, aperture: shot.spec.camera.aperture, focus: shot.spec.camera.focus,
        lighting: shot.spec.lighting, scene: shot.spec.scene, subject_action: shot.spec.subject_action ?? "the piece turns slowly to catch the light",
        product_placement: { product_id: sc.products[0]?.id ?? "p", visibility: shot.spec.product_visibility ?? "full" }, keyframe_prompt_hint: "", video_prompt_hint: shot.spec.video_prompt_hint ?? "",
      });
      prompt = compileVideoPrompt(sbs.success ? { ...sbs.data, duration_s: Math.min(Math.max(duration, 2), 8) } : fallback, product, sc.talent?.name, mode === "r2v" ? 1400 : 900);
    }
    const capability: CapabilityId = p.capability ?? (mode === "preset" ? "video.generate.product_preset" : mode === "r2v" ? "video.generate.r2v" : mode === "flf" ? "video.generate.flf" : "video.generate.i2v");
    const videoImplId = p.impl_id ?? sc.campaign.settings.video_capability_override;
    const refs: AssetRow[] = [];
    if (mode === "r2v") {
      refs.push(keyframe);
      for (const pr of sc.products) for (const r of productReferenceSet(pr, 3)) refs.push(r.asset);
      if (sc.talent) for (const r of talentReferenceSet(sc.talent, shot.spec.crop, 3)) refs.push(r.asset);
    }
    updateShot(ctx.db, shot.id, { status: "generating" });
    const variants = p.variants ?? sc.campaign.settings.clip_variants;
    const out = await runGeneration(ctx, {
      capability, implId: videoImplId, kind: "video", prompt, refs: mode === "r2v" ? refs : [], startFrame: mode === "r2v" ? keyframe : keyframe, endFrame,
      aspect: sb?.aspect ?? shot.spec.aspect, resolution: p.resolution ?? (sc.campaign.settings.resolution === "4k" ? "4k" : "1080p"), durationS: duration, count: variants, seed: p.seed,
      extraParams: mode === "r2v" ? { mode: "pro" } : undefined,
      outDir: projectOutDir(sc.campaign.projectId, "shots", shot.id, "clips"), outBase: `${ctx.job.id}`,
      projectId: sc.campaign.projectId, campaignId: sc.campaign.id, shotId: shot.id, stage: "clips", label: shot.title,
    });
    const candidateIds: string[] = [];
    for (let i = 0; i < out.files.length; i++) {
      const a = await registerAsset(ctx.db, { projectId: sc.campaign.projectId, absFile: out.files[i], role: "clip", kind: "video", sourceJobId: ctx.job.id, providerUrl: out.providerUrls[i], meta: { shot_id: shot.id, stage: "clips", model: out.impl.model, lane: out.impl.lane, mode, index: i, generation_id: out.generationId }, tags: ["clips"] });
      // frames
      const fdir = projectOutDir(sc.campaign.projectId, "shots", shot.id, "frames");
      try {
        await extractFrame(assetAbs(a), path.join(fdir, `${a.id}-first.png`), "first");
        await extractFrame(assetAbs(a), path.join(fdir, `${a.id}-last.png`), "last");
        const first = await registerAsset(ctx.db, { projectId: sc.campaign.projectId, absFile: path.join(fdir, `${a.id}-first.png`), role: "frame", kind: "image", parentAssetId: a.id, meta: { which: "first" } });
        const last = await registerAsset(ctx.db, { projectId: sc.campaign.projectId, absFile: path.join(fdir, `${a.id}-last.png`), role: "frame", kind: "image", parentAssetId: a.id, meta: { which: "last" } });
        ctx.db.update(candidates).set({}).where(eq(candidates.id, "noop")).run();
        void first; void last;
      } catch (e) {
        ctx.emit("log", { line: `frame extraction failed: ${(e as Error).message}` });
      }
      const cid = newId();
      ctx.db.insert(candidates).values({ id: cid, generationId: out.generationId, shotId: shot.id, stage: "clips", assetId: a.id, index: i, review: "unreviewed", createdAt: Date.now() }).run();
      candidateIds.push(cid);
      ctx.emit("artifact", { asset_id: a.id, candidate_id: cid, shot_id: shot.id, stage: "clips" });
    }
    updateShot(ctx.db, shot.id, { status: "review" });
    ctx.enqueueChild("qa.video", { candidate_ids: candidateIds, shot_id: shot.id }, { label: `QA clip ${shot.title}` });
    return { candidate_ids: candidateIds, generation_id: out.generationId };
  },
};

export const fanoutAwait: HandlerSpec<{ child_ids: string[]; campaign_id?: string; on_done_status?: string }> = {
  lane: "local",
  maxAttempts: 1,
  run: async (ctx) => {
    const { finishedStatus } = await import("@/queue/worker");
    for (;;) {
      const s = finishedStatus(ctx.db, ctx.payload.child_ids);
      ctx.progress((s.succeeded.length + s.failed.length) / Math.max(1, ctx.payload.child_ids.length) * 100, `${s.succeeded.length} done, ${s.failed.length} failed of ${ctx.payload.child_ids.length}`);
      if (s.done) {
        if (ctx.payload.campaign_id && ctx.payload.on_done_status) {
          const { updateCampaign } = await import("@/server/campaigns");
          updateCampaign(ctx.db, ctx.payload.campaign_id, { status: ctx.payload.on_done_status });
        }
        return { succeeded: s.succeeded.length, failed: s.failed.length };
      }
      if (ctx.isCancelled()) return { cancelled: true };
      await new Promise((r) => setTimeout(r, 1500));
      ctx.touch();
    }
  },
};

export const demoSleep: HandlerSpec<{ ms?: number }> = {
  lane: "local",
  run: async (ctx) => {
    const ms = ctx.payload.ms ?? 2000;
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      if (ctx.isCancelled()) return { cancelled: true };
      await new Promise((r) => setTimeout(r, ms / steps));
      ctx.progress((i / steps) * 100, `step ${i}/${steps}`);
    }
    return { slept: ms };
  },
};

export { shots };
