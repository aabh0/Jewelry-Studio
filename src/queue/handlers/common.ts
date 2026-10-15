import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { DB } from "@/db/client";
import { generations, ledger, uploadCache } from "@/db/schema";
import { env } from "@/env";
import { newId } from "@/lib/ids";
import { dirs, sha256File, mimeFor, extForMime } from "@/lib/files";
import { PermanentError, CancelledError, type HandlerContext } from "@/queue/types";
import { cloudClient, outputUrls, errorMessage } from "@/providers/higgsfield/cloud/client";
import { CloudApiError } from "@/providers/higgsfield/cloud/types";
import { CLOUD_ENDPOINTS, formulaEstimateUsd } from "@/providers/higgsfield/cloud/endpoints";
import { cliGenerate, cliEstimateCredits, cliDownload, CliError } from "@/providers/higgsfield/cli/adapter";
import { CLI_MODELS } from "@/providers/higgsfield/cli/models";
import { resolveCapability, laneStatus, markCliNeedsLogin, type CapabilityId, type Implementation } from "@/providers/capability";
import { capabilityOverrides, spendToday, dailyCapUsd } from "@/server/settings";
import { mockImage, mockVideo } from "@/providers/mock";
import { nearestAspect, ASPECT_DIMS } from "@/domain/delivery";
import { assetAbs, type AssetRow } from "@/server/assets";

export interface GenerationRequest {
  capability: CapabilityId;
  implId?: string; // force a specific implementation
  excludeImpls?: string[]; // implementations that cannot serve this request (e.g. Soul ID without a trained character)
  kind: "image" | "video";
  prompt: string;
  negative?: string;
  refs: AssetRow[]; // ordered; first is primary
  startFrame?: AssetRow;
  endFrame?: AssetRow;
  sourceVideo?: AssetRow;
  aspect?: string;
  resolution?: string; // 1k|2k|4k for images; 480p..4k for video
  durationS?: number;
  count: number; // how many outputs (images) — one request per output
  seed?: number;
  extraParams?: Record<string, unknown>;
  cliFlags?: Record<string, string | number | boolean | undefined>;
  outDir: string; // absolute
  outBase: string; // filename base without ext
  projectId: string | null;
  campaignId?: string | null;
  shotId?: string | null;
  stage?: string;
  label?: string;
  timeoutMs?: number;
}

export interface GenerationOutput {
  files: string[]; // absolute paths
  generationId: string;
  impl: Implementation;
  estimateUsd: number | null;
  estimateCredits: number | null;
  providerRequestIds: string[];
  providerUrls: string[];
  params: Record<string, unknown>;
}

function resolution(kind: "image" | "video", impl: Implementation, requested?: string): string | undefined {
  if (kind === "image") {
    const def = impl.lane === "cloud" ? CLOUD_ENDPOINTS[impl.model]?.resolutions : CLI_MODELS[impl.model]?.resolutions;
    if (!def) return undefined;
    if (requested && def.includes(requested)) return requested;
    if (def.includes("2k")) return "2k";
    return def[def.length - 1];
  }
  const def = impl.lane === "cloud" ? CLOUD_ENDPOINTS[impl.model]?.resolutions : CLI_MODELS[impl.model]?.resolutions;
  if (!def) return undefined;
  if (requested && def.includes(requested)) return requested;
  if (def.includes("1080p")) return "1080p";
  if (def.includes("720p")) return "720p";
  return def[0];
}

export async function uploadForCloud(db: DB, absFile: string): Promise<string> {
  const sha = await sha256File(absFile);
  const cached = db.select().from(uploadCache).where(eq(uploadCache.sha256, sha)).get();
  if (cached && cached.lane === "cloud" && Date.now() - cached.uploadedAt < 50 * 60_000) return cached.publicUrl;
  const url = await cloudClient().uploadFile(absFile);
  db.insert(uploadCache).values({ sha256: sha, lane: "cloud", publicUrl: url, uploadedAt: Date.now() }).onConflictDoUpdate({ target: uploadCache.sha256, set: { publicUrl: url, lane: "cloud", uploadedAt: Date.now() } }).run();
  return url;
}

function buildCloudParams(req: GenerationRequest, impl: Implementation, refUrls: string[], startUrl?: string, endUrl?: string, videoUrl?: string): Record<string, unknown> {
  const ep = CLOUD_ENDPOINTS[impl.model];
  const p: Record<string, unknown> = { prompt: req.prompt };
  if (req.kind === "image") {
    if (ep?.aspectRatios && req.aspect) p.aspect_ratio = nearestAspect(req.aspect, ep.aspectRatios);
    const res = resolution("image", impl, req.resolution);
    if (res) p.resolution = res;
    if (impl.model.startsWith("marketing-studio")) { p.quality = "high"; p.moderation = "auto"; p.enhance_prompt = false; }
    if (impl.model === "higgsfield-ai/soul/v2/standard") { p.batch_size = 1; p.enhance_prompt = false; if (req.seed) p.seed = req.seed; p.resolution = "1080p"; }
    if (impl.model.includes("qwen")) { if (req.negative) p.negative_prompt = req.negative; if (req.seed) p.seed = req.seed; }
    if (ep?.refField === "image_urls" && refUrls.length) p.image_urls = refUrls.slice(0, ep.maxRefs ?? 16);
    if (ep?.refField === "image_url" && refUrls.length) p.image_url = refUrls[0];
  } else {
    const durRange = ep?.durations;
    let d = req.durationS ?? 5;
    if (durRange && !Array.isArray(durRange)) d = Math.min(Math.max(Math.ceil(d), (durRange as { min: number }).min), (durRange as { max: number }).max);
    p.duration = d;
    const res = resolution("video", impl, req.resolution);
    if (res) p.resolution = res;
    if (ep?.aspectRatios && req.aspect) p.aspect_ratio = nearestAspect(req.aspect, ep.aspectRatios);
    if (impl.model.startsWith("kling-video")) { p.sound = "off"; if (impl.model.includes("v3.0") && !impl.model.includes("turbo")) p.cfg_scale = 0.5; if (impl.model.includes("o3")) { p.mode = req.extraParams?.mode ?? "pro"; p.shot_type = "customize"; p.multi_shots = false; delete p.resolution; } }
    if (impl.model.includes("seedance") || impl.model.includes("wan") || impl.model.includes("cinema-studio")) { p.generate_audio = false; if (impl.model.includes("seedance")) p.bitrate_mode = "high"; }
    if (startUrl && ep?.startField) p[ep.startField] = startUrl;
    if (endUrl && ep?.endField) p[ep.endField] = endUrl;
    if (videoUrl) p.video_url = videoUrl;
    if (ep?.refField === "image_urls" && refUrls.length) p.image_urls = refUrls.slice(0, ep.maxRefs ?? 9);
    if (impl.model.includes("genjutsu")) p.resolution = "720p";
  }
  for (const [k, v] of Object.entries(req.extraParams ?? {})) if (v !== undefined) p[k] = v;
  return p;
}

function buildCliCall(req: GenerationRequest, impl: Implementation, refs: string[], start?: string, end?: string, video?: string) {
  const m = CLI_MODELS[impl.model];
  const flags: Record<string, string | number | boolean | undefined> = {};
  const media: { flag: string; path: string }[] = [];
  if (req.kind === "image") {
    if (m?.aspectRatios && req.aspect) flags.aspect_ratio = nearestAspect(req.aspect, m.aspectRatios);
    const res = resolution("image", impl, req.resolution);
    if (res && m?.resolutions) flags.resolution = res;
    if (impl.model === "gpt_image_2_5") { flags.quality = "high"; flags.variant = "flare"; }
    if (impl.model === "gpt_image_2") flags.quality = "high";
    if (m?.qualities?.includes("high") && !flags.quality) flags.quality = "high";
    if (m?.qualities?.includes("2k")) flags.quality = "2k";
    const rf = m?.refFlag ?? "--image";
    for (const r of refs.slice(0, m?.maxRefs ?? 8)) media.push({ flag: rf, path: r });
  } else {
    flags.duration = Math.max(3, Math.ceil(req.durationS ?? 5));
    if (impl.model === "kling3_0") { flags.mode = (req.extraParams?.mode as string) ?? "pro"; flags.sound = "off"; if (req.aspect) flags.aspect_ratio = nearestAspect(req.aspect, ["16:9", "9:16", "1:1"]); }
    if (impl.model === "seedance_2_5") { flags.mode = "omni_reference"; flags.resolution = resolution("video", impl, req.resolution) ?? "1080p"; flags.generate_audio = false; if (req.aspect) flags.aspect_ratio = req.aspect; }
    if (impl.model === "seedance_2_0") { flags.resolution = resolution("video", impl, req.resolution) ?? "1080p"; flags.generate_audio = false; if (req.aspect) flags.aspect_ratio = req.aspect; }
    if (start) media.push({ flag: "--start-image", path: start });
    if (end) media.push({ flag: "--end-image", path: end });
    if (video) media.push({ flag: "--video", path: video });
    if (m?.refFlag) for (const r of refs.slice(0, m.maxRefs ?? 8)) media.push({ flag: m.refFlag, path: r });
  }
  for (const [k, v] of Object.entries(req.cliFlags ?? {})) flags[k] = v;
  return { flags, media, workflow: impl.model === "reframe" };
}

function recordLedger(db: DB, o: { jobId: string; lane: string; modelId: string; estimateUsd?: number | null; credits?: number | null; projectId?: string | null; campaignId?: string | null; note?: string }) {
  // One ledger row per logical generation job and model: a retry after a crash updates the row instead of double-counting.
  const existing = db.select({ id: ledger.id }).from(ledger).where(and(eq(ledger.jobId, o.jobId), eq(ledger.modelId, o.modelId))).get();
  if (existing) {
    db.update(ledger).set({ estimateUsd: o.estimateUsd ?? null, credits: o.credits ?? null, note: o.note ?? null }).where(eq(ledger.id, existing.id)).run();
    return;
  }
  db.insert(ledger).values({ id: newId(), jobId: o.jobId, lane: o.lane, provider: o.lane === "cli" ? "higgsfield_cli" : o.lane === "cloud" ? "higgsfield_cloud" : "local", modelId: o.modelId, estimateUsd: o.estimateUsd ?? null, actualUsd: null, credits: o.credits ?? null, currency: o.credits !== undefined && o.credits !== null ? "credits" : "usd", projectId: o.projectId ?? null, campaignId: o.campaignId ?? null, note: o.note ?? null, at: Date.now() }).run();
}

/** Run one logical generation (N outputs) through the resolved lane, with estimate, ledger, cap, checkpoints and download. */
export async function runGeneration(ctx: HandlerContext, req: GenerationRequest): Promise<GenerationOutput> {
  const db = ctx.db;
  const status = await laneStatus();
  const overrides = capabilityOverrides(db);
  const resolved = resolveCapability(req.capability, status, req.implId ? { ...overrides, [req.capability]: req.implId } : overrides, { exclude: req.excludeImpls });
  if (resolved.unavailable) throw new PermanentError(`${req.capability} is unavailable: ${resolved.reason}`, "capability_unavailable");
  // In mock mode, pretend the first implementation runs.
  const impl = resolved.impl;
  await fs.mkdir(req.outDir, { recursive: true });
  const generationId = newId();
  const ext = req.kind === "image" ? ".png" : ".mp4";
  const count = Math.max(1, req.count);

  // persist generation row early
  db.insert(generations).values({
    id: generationId, shotId: req.shotId ?? null, jobId: ctx.job.id, stage: req.stage ?? "stills", capability: req.capability, lane: impl.lane, modelId: impl.model,
    paramsJson: "{}", promptText: req.prompt, negativeText: req.negative ?? null, referenceAssetIdsJson: JSON.stringify(req.refs.map((r) => r.id)), seed: req.seed ?? null, status: "running", createdAt: Date.now(),
  }).run();
  const setGen = (patch: Partial<typeof generations.$inferInsert>) => db.update(generations).set(patch).where(eq(generations.id, generationId)).run();

  const files: string[] = [];
  const providerRequestIds: string[] = [];
  const providerUrls: string[] = [];
  let estimateUsd: number | null = null;
  let estimateCredits: number | null = null;
  let params: Record<string, unknown> = {};

  try {
    if (env.MOCK_PROVIDERS || status.mock) {
      ctx.progress(10, `Mock ${req.kind} generation (${impl.label})`);
      const [w, h] = ASPECT_DIMS[req.aspect ?? "1:1"] ?? [1024, 1024];
      for (let i = 0; i < count; i++) {
        if (ctx.isCancelled()) throw new CancelledError();
        const f = path.join(req.outDir, `${req.outBase}-${i + 1}${ext}`);
        await new Promise((r) => setTimeout(r, Number(process.env.MOCK_LATENCY_MS ?? 150)));
        if (req.kind === "image") await mockImage(f, { width: Math.round(w / 2), height: Math.round(h / 2), label: req.label ?? req.prompt.slice(0, 60), seed: `${req.outBase}-${i}-${req.seed ?? ""}`, refImage: req.refs[0] ? assetAbs(req.refs[0]) : undefined });
        else await mockVideo(f, { width: Math.round(w / 3) * 2 % 2 === 0 ? Math.round(w / 3) : Math.round(w / 3) + 1, height: Math.round(h / 3) % 2 === 0 ? Math.round(h / 3) : Math.round(h / 3) + 1, durationS: Math.min(req.durationS ?? 4, 6), seed: `${req.outBase}-${i}`, startImage: req.startFrame ? assetAbs(req.startFrame) : undefined });
        files.push(f);
        ctx.progress(10 + ((i + 1) / count) * 85, `Mock output ${i + 1}/${count}`);
      }
      estimateUsd = +(0.05 * count).toFixed(3);
      params = { mock: true, aspect: req.aspect, resolution: req.resolution, duration: req.durationS };
      recordLedger(db, { jobId: ctx.job.id, lane: "cloud", modelId: `mock:${impl.model}`, estimateUsd, projectId: req.projectId, campaignId: req.campaignId, note: "mock" });
    } else if (impl.lane === "cloud") {
      const client = cloudClient();
      ctx.progress(3, "Uploading references");
      const refUrls: string[] = [];
      for (const r of req.refs) refUrls.push(await uploadForCloud(db, assetAbs(r)));
      const startUrl = req.startFrame ? await uploadForCloud(db, assetAbs(req.startFrame)) : undefined;
      const endUrl = req.endFrame ? await uploadForCloud(db, assetAbs(req.endFrame)) : undefined;
      const videoUrl = req.sourceVideo ? await uploadForCloud(db, assetAbs(req.sourceVideo)) : undefined;
      params = buildCloudParams(req, impl, refUrls, startUrl, endUrl, videoUrl);
      setGen({ paramsJson: JSON.stringify(params) });
      ctx.progress(6, "Estimating cost");
      let unit: number | null = null;
      try {
        const est = await client.estimate(impl.model, params);
        unit = est.usd ?? formulaEstimateUsd(impl.model, params);
      } catch {
        unit = formulaEstimateUsd(impl.model, params);
      }
      estimateUsd = unit !== null ? +(unit * count).toFixed(4) : null;
      const cap = dailyCapUsd(db);
      if (estimateUsd !== null && spendToday(db) + estimateUsd > cap) throw new PermanentError(`Daily spend cap of $${cap.toFixed(2)} would be exceeded (estimate $${estimateUsd.toFixed(2)}). Raise the cap in Settings.`, "cap_exceeded");
      recordLedger(db, { jobId: ctx.job.id, lane: "cloud", modelId: impl.model, estimateUsd, projectId: req.projectId, campaignId: req.campaignId });
      ctx.emit("cost", { estimate_usd: estimateUsd ?? undefined });
      setGen({ estimateUsd });
      const existing = ((ctx.job.result as { provider_request_ids?: string[] } | undefined)?.provider_request_ids ?? []).slice();
      for (let i = 0; i < count; i++) {
        if (ctx.isCancelled()) throw new CancelledError();
        const body = { ...params, ...(req.seed ? { seed: req.seed + i } : {}) };
        let requestId = existing[i];
        if (!requestId) {
          const idem = crypto.createHash("sha256").update(`${ctx.job.id}:${generationId}:${i}:${JSON.stringify(body)}`).digest("hex").slice(0, 32);
          ctx.progress(8 + (i / count) * 10, `Submitting ${i + 1}/${count} to ${impl.label}`);
          const sub = await client.submit(impl.model, body, { idempotencyKey: idem });
          requestId = sub.request_id;
          existing[i] = requestId;
          ctx.checkpoint({ provider_request_ids: existing.slice() });
          providerRequestIds.push(requestId);
          setGen({ providerRequestId: existing.join(",") });
        }
        const timeout = req.timeoutMs ?? (req.kind === "image" ? 15 * 60_000 : 40 * 60_000);
        const res = await client.waitFor(requestId, {
          timeoutMs: timeout,
          onPoll: (s) => ctx.progress(20 + ((i + 0.5) / count) * 65, `${impl.label}: ${s.status.replace("_", " ")} (${i + 1}/${count})`),
          isCancelled: ctx.isCancelled,
          onCancel: async () => { await client.cancel(requestId!).catch(() => {}); },
        });
        if (res.status !== "completed") {
          if (res.status === "nsfw") throw new PermanentError(errorMessage(res), "nsfw");
          throw new Error(errorMessage(res));
        }
        const urls = outputUrls(res);
        if (urls.length === 0) throw new Error("Provider returned no output URL");
        const url = urls[0];
        const f = path.join(req.outDir, `${req.outBase}-${i + 1}${ext}`);
        ctx.progress(85 + ((i + 1) / count) * 10, `Downloading ${i + 1}/${count}`);
        await client.download(url, f);
        providerUrls.push(url);
        files.push(f);
      }
    } else if (impl.lane === "cli") {
      const refs = req.refs.map((r) => assetAbs(r));
      const start = req.startFrame ? assetAbs(req.startFrame) : undefined;
      const end = req.endFrame ? assetAbs(req.endFrame) : undefined;
      const video = req.sourceVideo ? assetAbs(req.sourceVideo) : undefined;
      const call = buildCliCall(req, impl, refs, start, end, video);
      params = { flags: call.flags, media: call.media.map((m) => ({ flag: m.flag, path: path.basename(m.path) })) };
      setGen({ paramsJson: JSON.stringify(params) });
      ctx.progress(5, "Estimating credits");
      const unit = await cliEstimateCredits({ jobSetType: impl.model, prompt: req.prompt, flags: call.flags, workflow: call.workflow });
      estimateCredits = unit !== null ? unit * count : null;
      recordLedger(db, { jobId: ctx.job.id, lane: "cli", modelId: impl.model, credits: estimateCredits, projectId: req.projectId, campaignId: req.campaignId });
      ctx.emit("cost", { credits: estimateCredits ?? undefined });
      setGen({ estimateCredits });
      for (let i = 0; i < count; i++) {
        if (ctx.isCancelled()) throw new CancelledError();
        ctx.progress(10 + (i / count) * 80, `${impl.label}: generating ${i + 1}/${count}`);
        const ac = new AbortController();
        const cancelPoll = setInterval(() => { if (ctx.isCancelled()) ac.abort(); }, 2000);
        let result;
        try {
          result = await cliGenerate({ jobSetType: impl.model, prompt: req.prompt, flags: call.flags, media: call.media, workflow: call.workflow, timeoutMs: req.timeoutMs, logName: ctx.job.id, signal: ac.signal, onLine: (l) => { if (/\d+%/.test(l)) ctx.emit("log", { line: l.trim() }); } });
        } catch (err) {
          if (err instanceof CliError && err.code === "needs_login") { markCliNeedsLogin(); throw new PermanentError(err.message, "needs_login"); }
          if (err instanceof CliError && err.code === "not_installed") throw new PermanentError(err.message, "not_installed");
          throw err;
        } finally {
          clearInterval(cancelPoll);
        }
        if (result.jobId) { providerRequestIds.push(result.jobId); ctx.checkpoint({ provider_request_ids: providerRequestIds.slice() }); }
        const url = result.urls[0];
        const urlExt = path.extname(new URL(url).pathname).toLowerCase() || extForMime(mimeFor(url)) || ext;
        const f = path.join(req.outDir, `${req.outBase}-${i + 1}${urlExt.startsWith(".") ? urlExt : "." + urlExt}`);
        await cliDownload(url, f);
        providerUrls.push(url);
        files.push(f);
      }
    } else {
      throw new PermanentError(`Capability ${req.capability} resolved to a local implementation (${impl.model}); use the dedicated local path.`, "local_only");
    }
    setGen({ status: "succeeded", finishedAt: Date.now(), actualUsd: estimateUsd, providerRequestId: providerRequestIds.join(",") || null });
    ctx.progress(97, "Done");
    return { files, generationId, impl, estimateUsd, estimateCredits, providerRequestIds, providerUrls, params };
  } catch (err) {
    const e = err as Error;
    if (err instanceof CloudApiError) {
      setGen({ status: "failed", error: e.message, finishedAt: Date.now() });
      if (err.code === "auth" || err.code === "insufficient_credits" || err.code === "validation" || err.code === "not_found" || err.code === "missing_credentials" || err.code === "nsfw") throw new PermanentError(e.message, err.code);
      if (err.code === "cancelled") throw new CancelledError();
      throw e;
    }
    setGen({ status: (e as { cancelled?: boolean }).cancelled ? "cancelled" : "failed", error: e.message, finishedAt: Date.now() });
    throw err;
  }
}

export function projectOutDir(projectId: string, ...sub: string[]): string {
  return path.join(dirs.project(projectId), ...sub);
}
