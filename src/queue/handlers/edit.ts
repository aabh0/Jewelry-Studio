import path from "node:path";
import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import type { HandlerSpec } from "@/queue/types";
import { PermanentError } from "@/queue/types";
import { edits } from "@/db/schema";
import { runGeneration, projectOutDir } from "./common";
import { getAsset, registerAsset, assetAbs, type AssetRow } from "@/server/assets";
import { getProduct } from "@/server/products";
import { compileRefine, compileRelight, compileInpaint, compileOutpaint, compileUpscaleRerender } from "@/domain/prompt/compile";
import { zLightingSpec } from "@/domain/lighting";
import { padToAspect, compositeWithMask, compositeRect, similarity, upscaleLocal, adjust, cropToRect } from "@/providers/local/sharp";
import { runFfmpeg, ENCODE_H264, ENCODE_AAC, normalizeFilter, extractFrame } from "@/providers/local/ffmpeg";
import { probe } from "@/providers/local/ffprobe";
import { laneStatus, resolveCapability } from "@/providers/capability";
import { capabilityOverrides } from "@/server/settings";
import { env } from "@/env";
import { notFound } from "@/server/errors";

interface EditParams {
  instruction?: string;
  product_id?: string;
  lighting?: unknown;
  aspect?: string;
  scene_hint?: string;
  factor?: number;
  crop?: { left: number; top: number; width: number; height: number };
  adjust?: { brightness?: number; saturation?: number; contrast?: number; warmth?: number };
  focal?: { x: number; y: number }[];
  target?: { width: number; height: number };
  duration_s?: number;
  prompt?: string;
  ref_asset_ids?: string[];
  impl_id?: string;
}

async function redOutline(src: string, mask: string, dest: string): Promise<void> {
  const m = await sharp(src).metadata();
  const w = m.width ?? 0, h = m.height ?? 0;
  const maskBuf = await sharp(mask).resize(w, h, { fit: "fill" }).grayscale().threshold(128).raw().toBuffer();
  // outline = mask minus eroded mask (cheap: dilate via blur threshold difference)
  const blurred = await sharp(mask).resize(w, h, { fit: "fill" }).grayscale().blur(3).threshold(100).raw().toBuffer();
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const edge = blurred[i] > 0 && maskBuf[i] === 0;
    rgba[i * 4] = 255; rgba[i * 4 + 1] = 32; rgba[i * 4 + 2] = 32; rgba[i * 4 + 3] = edge ? 255 : 0;
  }
  await sharp(src).composite([{ input: rgba, raw: { width: w, height: h, channels: 4 } }]).png().toFile(dest);
}

export const editRun: HandlerSpec<{ edit_id: string }> = {
  lane: "provider",
  maxAttempts: 1,
  run: async (ctx) => {
    const e = ctx.db.select().from(edits).where(eq(edits.id, ctx.payload.edit_id)).get();
    if (!e) throw notFound("Edit");
    const src = getAsset(ctx.db, e.sourceAssetId);
    const params = JSON.parse(e.paramsJson) as EditParams;
    const product = params.product_id ? getProduct(ctx.db, params.product_id) : undefined;
    const prod = product ? { spec: product.spec, invariants: product.invariants } : undefined;
    const projectId = e.projectId;
    const outDir = projectOutDir(projectId, "edits");
    await fs.mkdir(outDir, { recursive: true });
    const version = (src.version ?? 1) + 1;
    const base = `${src.id}-v${version}-${e.op}`;
    const status = await laneStatus();
    const overrides = capabilityOverrides(ctx.db);
    ctx.db.update(edits).set({ status: "running" }).where(eq(edits.id, e.id)).run();
    let resultFile: string | null = null;
    let meta: Record<string, unknown> = { op: e.op, params };
    const srcAbs = assetAbs(src);

    const gen = async (capability: Parameters<typeof resolveCapability>[0], prompt: string, refs: AssetRow[], extra: Partial<Parameters<typeof runGeneration>[1]> = {}) => {
      const out = await runGeneration(ctx, { capability, implId: params.impl_id, kind: extra.kind ?? "image", prompt, refs, aspect: extra.aspect ?? (src.width && src.height ? closestAspect(src.width, src.height) : "1:1"), resolution: extra.resolution ?? "2k", count: 1, outDir, outBase: base, projectId, label: `${e.op} ${src.id}`, ...extra });
      return out;
    };

    try {
      switch (e.op) {
        case "refine": {
          const out = await gen("image.edit.refine", compileRefine(params.instruction ?? "improve the weakest detail", prod), [src, ...(params.ref_asset_ids ?? []).map((id) => getAsset(ctx.db, id))]);
          resultFile = out.files[0];
          break;
        }
        case "relight": {
          const lighting = zLightingSpec.parse(params.lighting ?? {});
          const out = await gen("image.edit.relight", compileRelight(lighting, prod), [src]);
          resultFile = out.files[0];
          break;
        }
        case "inpaint": {
          if (!e.maskAssetId) throw new PermanentError("Inpaint needs a mask.");
          const mask = getAsset(ctx.db, e.maskAssetId);
          const resolved = resolveCapability("image.edit.inpaint", status, overrides);
          if (resolved.impl.lane === "cli" && !env.MOCK_PROVIDERS) {
            const out = await runGeneration(ctx, { capability: "image.edit.inpaint", kind: "image", prompt: params.instruction ?? "", refs: [src], aspect: "auto", resolution: "2k", count: 1, outDir, outBase: base, projectId, label: `inpaint ${src.id}`, cliFlags: { is_inpaint: "true", mask: assetAbs(mask) } });
            resultFile = out.files[0];
          } else {
            const preview = path.join(outDir, `${base}-outline.png`);
            await redOutline(srcAbs, assetAbs(mask), preview);
            const previewAsset = await registerAsset(ctx.db, { projectId, absFile: preview, role: "mask", kind: "mask", parentAssetId: src.id, meta: { kind: "outline_preview" } });
            const out = await gen("image.edit.refine", compileInpaint(params.instruction ?? "", prod), [src, previewAsset]);
            const composited = path.join(outDir, `${base}.png`);
            const tmp = path.join(outDir, `${base}-raw.png`);
            await fs.rename(out.files[0], tmp);
            await compositeWithMask(srcAbs, tmp, assetAbs(mask), composited, 12);
            await fs.unlink(tmp).catch(() => {});
            resultFile = composited;
            meta = { ...meta, composited: true };
          }
          break;
        }
        case "outpaint": {
          const [aw, ah] = (params.aspect ?? "16:9").split(":").map(Number);
          const resolved = resolveCapability("image.edit.outpaint", status, overrides);
          if (resolved.impl.lane === "cli" && !env.MOCK_PROVIDERS) {
            const out = await runGeneration(ctx, { capability: "image.edit.outpaint", kind: "image", prompt: "", refs: [src], aspect: params.aspect ?? "16:9", resolution: "2k", count: 1, outDir, outBase: base, projectId, label: `outpaint ${src.id}` });
            resultFile = out.files[0];
          } else {
            const padded = path.join(outDir, `${base}-padded.png`);
            const info = await padToAspect(srcAbs, padded, aw, ah);
            const paddedAsset = await registerAsset(ctx.db, { projectId, absFile: padded, role: "mask", kind: "image", parentAssetId: src.id, meta: { kind: "padded" } });
            const out = await gen("image.edit.refine", compileOutpaint(params.aspect ?? "16:9", params.scene_hint), [paddedAsset], { aspect: params.aspect ?? "16:9" });
            const final = path.join(outDir, `${base}.png`);
            // Provider output may not match padded dims exactly; scale the inner rect proportionally.
            const om = await sharp(out.files[0]).metadata();
            const sx = (om.width ?? info.width) / info.width, sy = (om.height ?? info.height) / info.height;
            await compositeRect(out.files[0], srcAbs, { left: Math.round(info.inner.left * sx), top: Math.round(info.inner.top * sy), width: Math.round(info.inner.width * sx), height: Math.round(info.inner.height * sy) }, final);
            await fs.unlink(out.files[0]).catch(() => {});
            resultFile = final;
            meta = { ...meta, composited: true };
          }
          break;
        }
        case "cutout": {
          const out = await gen(status.cli.available && !env.MOCK_PROVIDERS ? "image.cutout" : "image.clean_plate", prod ? compileRefine("isolate the product on a seamless light-grey studio background, straightened and level", prod) : "Isolate the product on a seamless light-grey studio background.", [src]);
          resultFile = out.files[0];
          break;
        }
        case "upscale": {
          const resolved = resolveCapability("image.upscale", status, overrides);
          if (resolved.impl.lane === "local" || params.impl_id === "local.lanczos") {
            const dest = path.join(outDir, `${base}.png`);
            await upscaleLocal(srcAbs, dest, params.factor ?? 2);
            resultFile = dest;
            meta = { ...meta, method: "lanczos" };
          } else if (resolved.impl.id === "cloud.generative" || (resolved.impl.lane === "cloud")) {
            const out = await gen("image.upscale", compileUpscaleRerender(), [src], { resolution: "4k" });
            const sim = await similarity(srcAbs, out.files[0]);
            meta = { ...meta, method: "generative", similarity: sim };
            if (sim < 0.85) {
              meta = { ...meta, gate: "failed", note: "Generative upscale drifted from the source; kept as a review candidate." };
            }
            resultFile = out.files[0];
          } else {
            const out = await gen("image.upscale", "", [src]);
            resultFile = out.files[0];
            meta = { ...meta, method: resolved.impl.model };
          }
          break;
        }
        case "crop": {
          if (!params.crop) throw new PermanentError("Crop needs a rect.");
          const dest = path.join(outDir, `${base}.png`);
          await cropToRect(srcAbs, dest, params.crop);
          resultFile = dest;
          break;
        }
        case "adjust": {
          const dest = path.join(outDir, `${base}.png`);
          await adjust(srcAbs, dest, params.adjust ?? {});
          resultFile = dest;
          break;
        }
        case "reframe": {
          if (src.kind !== "video") throw new PermanentError("Reframe applies to video.");
          const resolved = resolveCapability("video.edit.reframe", status, overrides);
          if (resolved.impl.lane === "cli" && !env.MOCK_PROVIDERS) {
            const out = await runGeneration(ctx, { capability: "video.edit.reframe", kind: "video", prompt: "", refs: [], sourceVideo: src, aspect: params.aspect ?? "9:16", count: 1, outDir, outBase: base, projectId, label: `reframe ${src.id}`, cliFlags: { "aspect-ratio": params.aspect ?? "9:16", resolution: "1080p" } });
            resultFile = out.files[0];
          } else {
            const target = params.target ?? aspectDims(params.aspect ?? "9:16");
            const dest = path.join(outDir, `${base}.mp4`);
            const focal = params.focal?.[0] ?? { x: 0.5, y: 0.5 };
            const vf = normalizeFilter(target.width, target.height, "cover", 30, focal);
            const p = await probe(srcAbs);
            await runFfmpeg(["-i", srcAbs, "-vf", vf, ...ENCODE_H264, ...(p.hasAudio ? ENCODE_AAC : ["-an"]), dest], { logName: ctx.job.id, onProgress: (s) => ctx.progress(Math.min(95, (s / ((p.durationMs ?? 5000) / 1000)) * 100), "Reframing") });
            resultFile = dest;
            meta = { ...meta, method: "ffmpeg_focal_crop" };
          }
          break;
        }
        case "extend": {
          if (src.kind !== "video") throw new PermanentError("Extend applies to video.");
          const resolved = resolveCapability("video.edit.extend", status, overrides);
          if (resolved.impl.lane === "cloud" || env.MOCK_PROVIDERS) {
            const out = await runGeneration(ctx, { capability: "video.edit.extend", kind: "video", prompt: params.prompt ?? "Continue the shot naturally with the same camera motion and lighting; product identical in every frame.", refs: [], sourceVideo: src, durationS: params.duration_s ?? 8, aspect: params.aspect, count: 1, outDir, outBase: base, projectId, label: `extend ${src.id}` });
            resultFile = out.files[0];
          } else {
            const last = path.join(outDir, `${base}-last.png`);
            await extractFrame(srcAbs, last, "last");
            const lastAsset = await registerAsset(ctx.db, { projectId, absFile: last, role: "frame", kind: "image", parentAssetId: src.id });
            const out = await runGeneration(ctx, { capability: "video.generate.i2v", kind: "video", prompt: params.prompt ?? "Continue the shot naturally with the same camera motion and lighting; product identical in every frame.", refs: [], startFrame: lastAsset, durationS: params.duration_s ?? 5, aspect: params.aspect, count: 1, outDir, outBase: `${base}-cont`, projectId, label: `continue ${src.id}` });
            const dest = path.join(outDir, `${base}.mp4`);
            const p1 = await probe(srcAbs);
            const w = p1.width ?? 1080, h = p1.height ?? 1920;
            const d1 = (p1.durationMs ?? 0) / 1000;
            await runFfmpeg(["-i", srcAbs, "-i", out.files[0], "-filter_complex", `[0:v]${normalizeFilter(w, h, "cover")}[v0];[1:v]${normalizeFilter(w, h, "cover")}[v1];[v0][v1]xfade=transition=fade:duration=0.2:offset=${Math.max(0, d1 - 0.2).toFixed(2)}[v]`, "-map", "[v]", ...ENCODE_H264, "-an", dest], { logName: ctx.job.id });
            resultFile = dest;
            meta = { ...meta, method: "continue_from_last_frame" };
          }
          break;
        }
        case "object_swap": {
          if (src.kind !== "video") throw new PermanentError("Object swap applies to video.");
          const refs = (params.ref_asset_ids ?? []).map((id) => getAsset(ctx.db, id));
          if (refs.length === 0) throw new PermanentError("Object swap needs at least one reference image of the replacement product or person.");
          const out = await runGeneration(ctx, { capability: "video.edit.object_swap", kind: "video", prompt: params.instruction ?? "Replace the jewelry in the video with the referenced product, matching its exact geometry, metal and stones in every frame.", refs, sourceVideo: src, count: 1, outDir, outBase: base, projectId, label: `swap ${src.id}` });
          resultFile = out.files[0];
          break;
        }
        case "video_upscale": {
          const resolved = resolveCapability("video.upscale", status, overrides);
          if (resolved.impl.lane === "cli" && !env.MOCK_PROVIDERS) {
            const out = await runGeneration(ctx, { capability: "video.upscale", kind: "video", prompt: "", refs: [], sourceVideo: src, count: 1, outDir, outBase: base, projectId, label: `upscale ${src.id}` });
            resultFile = out.files[0];
          } else {
            const dest = path.join(outDir, `${base}.mp4`);
            const p = await probe(srcAbs);
            const w = (p.width ?? 1080) * 2, h = (p.height ?? 1920) * 2;
            await runFfmpeg(["-i", srcAbs, "-vf", `scale=${w}:${h}:flags=lanczos,unsharp=5:5:0.6:5:5:0.0`, ...ENCODE_H264, ...(p.hasAudio ? ENCODE_AAC : ["-an"]), dest], { logName: ctx.job.id });
            resultFile = dest;
            meta = { ...meta, method: "ffmpeg_lanczos" };
          }
          break;
        }
        default:
          throw new PermanentError(`Unknown edit op ${e.op}`);
      }
      if (!resultFile) throw new Error("Edit produced no file");
      const kind = src.kind === "video" && !["crop", "adjust"].includes(e.op) ? "video" : "image";
      const result = await registerAsset(ctx.db, { projectId, absFile: resultFile, role: "edit", kind: kind as "image" | "video", parentAssetId: src.id, version, sourceJobId: ctx.job.id, meta, tags: [e.op] });
      ctx.db.update(edits).set({ status: "succeeded", resultAssetId: result.id }).where(eq(edits.id, e.id)).run();
      ctx.emit("artifact", { asset_id: result.id, edit_id: e.id, parent_asset_id: src.id, op: e.op });
      return { result_asset_id: result.id };
    } catch (err) {
      ctx.db.update(edits).set({ status: "failed", error: (err as Error).message }).where(eq(edits.id, e.id)).run();
      throw err;
    }
  },
};

function closestAspect(w: number, h: number): string {
  const r = w / h;
  const opts: [string, number][] = [["1:1", 1], ["4:5", 0.8], ["3:4", 0.75], ["2:3", 0.667], ["9:16", 0.5625], ["16:9", 1.778], ["3:2", 1.5], ["4:3", 1.333], ["21:9", 2.333]];
  return opts.reduce((best, cur) => (Math.abs(cur[1] - r) < Math.abs(best[1] - r) ? cur : best))[0];
}

function aspectDims(aspect: string): { width: number; height: number } {
  const m: Record<string, [number, number]> = { "9:16": [1080, 1920], "1:1": [1080, 1080], "4:5": [1080, 1350], "16:9": [1920, 1080] };
  const [w, h] = m[aspect] ?? [1080, 1920];
  return { width: w, height: h };
}
