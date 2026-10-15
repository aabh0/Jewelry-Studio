import path from "node:path";
import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import type { HandlerSpec } from "@/queue/types";
import { PermanentError } from "@/queue/types";
import { timelines, exportsTable } from "@/db/schema";
import { zTimeline, type Timeline } from "@/domain/timeline";
import { getAsset, registerAsset, assetAbs } from "@/server/assets";
import { probe } from "@/providers/local/ffprobe";
import { runFfmpeg, ENCODE_H264, ENCODE_H264_FAST, ENCODE_AAC, normalizeFilter, escapeFilterPath } from "@/providers/local/ffmpeg";
import { svgToPng, resizeCover } from "@/providers/local/sharp";
import { dirs, safeFilename } from "@/lib/files";
import { projectOutDir } from "./common";
import { channelById } from "@/domain/delivery";
import { getCampaign } from "@/server/campaigns";
import { getProject } from "@/server/projects";
import { notFound } from "@/server/errors";
import { fileURLToPath } from "node:url";
import fsSync from "node:fs";

function fontFile(name: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../../assets/fonts"), path.resolve(here, "../../../../assets/fonts"), path.resolve(process.cwd(), "assets/fonts")];
  for (const dir of candidates) {
    const f = path.join(dir, `${name}.ttf`);
    if (fsSync.existsSync(f)) return f;
  }
  return path.resolve(process.cwd(), "assets/fonts", `${name}.ttf`);
}

function overlayDrawtext(o: Timeline["clips"][number]["overlays"][number], W: number, H: number, textfile: string): string {
  const y = o.position === "top" ? `${Math.round(H * 0.12)}` : o.position === "center" ? "(h-text_h)/2" : `h-text_h-${Math.round(H * 0.14)}`;
  const box = o.bg ? `:box=1:boxcolor=${o.bg.color}@${o.bg.opacity}:boxborderw=18` : "";
  return `drawtext=fontfile='${escapeFilterPath(fontFile(o.font))}':textfile='${escapeFilterPath(textfile)}':fontsize=${o.size_px}:fontcolor=${o.color}:x=(w-text_w)/2:y=${y}:enable='between(t,${o.in_s},${o.out_s})'${box}`;
}

export async function renderTimeline(tl: Timeline, dest: string, opts: { preview?: boolean; onProgress?: (pct: number, msg: string) => void; logName?: string }): Promise<void> {
  const W = opts.preview ? Math.round((tl.output.width * 540) / tl.output.height / 2) * 2 : tl.output.width;
  const H = opts.preview ? 540 : tl.output.height;
  const fps = tl.output.fps;
  const work = path.join(dirs.tmp(), `render-${Date.now()}`);
  await fs.mkdir(work, { recursive: true });
  const enc = opts.preview ? ENCODE_H264_FAST : ENCODE_H264;
  const parts: { file: string; duration: number; hasAudio: boolean }[] = [];
  let totalPlanned = 0;
  for (const c of tl.clips) totalPlanned += (c.out_s ?? 5) - c.in_s;

  // 1. normalize each clip
  for (const [i, c] of tl.clips.entries()) {
    const src = c.asset_id;
    const abs = c.asset_id.startsWith("/") ? c.asset_id : src; // resolved by caller to abs path in asset_id field
    const p = await probe(abs);
    const srcDur = (p.durationMs ?? 0) / 1000;
    const out = Math.min(c.out_s ?? srcDur, srcDur);
    const dur = Math.max(0.1, out - c.in_s);
    const outFile = path.join(work, `clip${i}.mp4`);
    const filters = [normalizeFilter(W, H, c.fit, fps, c.focal)];
    if (c.speed !== 1) filters.push(`setpts=${(1 / c.speed).toFixed(4)}*PTS`);
    for (const [k, o] of c.overlays.entries()) {
      const tf = path.join(work, `text${i}_${k}.txt`);
      await fs.writeFile(tf, o.copy, "utf8");
      filters.push(overlayDrawtext(o, W, H, tf));
    }
    const audio = tl.keep_clip_audio && p.hasAudio ? [...ENCODE_AAC] : ["-an"];
    await runFfmpeg(["-ss", String(c.in_s), "-t", String(dur), "-i", abs, "-vf", filters.join(","), "-r", String(fps), ...enc, ...audio, outFile], { logName: opts.logName, onProgress: (s) => opts.onProgress?.(((i + Math.min(1, s / dur)) / (tl.clips.length + 2)) * 60, `Preparing clip ${i + 1}/${tl.clips.length}`) });
    parts.push({ file: outFile, duration: dur / c.speed, hasAudio: tl.keep_clip_audio && p.hasAudio });
  }
  // 2. end card
  if (tl.end_card) {
    const png = path.join(work, "endcard.png");
    const copy = tl.end_card.copy ? escapeXml(tl.end_card.copy) : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="${tl.end_card.bg_color}"/>${copy ? `<text x="50%" y="52%" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-size="${Math.round(W / 11)}" fill="#F5F3EE">${copy}</text>` : ""}</svg>`;
    await svgToPng(svg, png);
    if (tl.end_card.logo_asset_id) {
      try {
        const logo = await import("sharp").then((m) => m.default(tl.end_card!.logo_asset_id!).resize(Math.round(W * 0.35), Math.round(H * 0.2), { fit: "inside" }).png().toBuffer());
        await import("sharp").then((m) => m.default(png).composite([{ input: logo, gravity: copy ? "north" : "center", top: copy ? Math.round(H * 0.22) : undefined, left: copy ? Math.round(W * 0.325) : undefined }]).png().toFile(png + ".2.png"));
        await fs.rename(png + ".2.png", png);
      } catch { /* logo optional */ }
    }
    const outFile = path.join(work, "endcard.mp4");
    await runFfmpeg(["-loop", "1", "-i", png, "-t", String(tl.end_card.duration_s), "-vf", `fade=t=in:st=0:d=${tl.end_card.fade_in_s},format=yuv420p`, "-r", String(fps), ...enc, "-an", outFile], { logName: opts.logName });
    parts.push({ file: outFile, duration: tl.end_card.duration_s, hasAudio: false });
  }
  if (parts.length === 0) throw new PermanentError("Timeline has no clips.");

  // 3. join (xfade chain or concat)
  const transitions = tl.clips.map((c) => c.transition_in).slice(1);
  const anyXfade = transitions.some((t) => t && t.type !== "cut") || !!tl.end_card;
  const joined = path.join(work, "joined.mp4");
  const anyAudio = parts.some((p) => p.hasAudio);
  if (!anyXfade) {
    const list = path.join(work, "list.txt");
    await fs.writeFile(list, parts.map((p) => `file '${p.file.replace(/'/g, "'\\''")}'`).join("\n"));
    await runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined], { logName: opts.logName });
  } else {
    const inputs = parts.flatMap((p) => ["-i", p.file]);
    let graph = "";
    let prev = "[0:v]";
    let offset = parts[0].duration;
    const audioLabels: string[] = [];
    for (let i = 1; i < parts.length; i++) {
      const t = i - 1 < transitions.length ? transitions[i - 1] : undefined;
      const type = t && t.type !== "cut" ? t.type : i === parts.length - 1 && tl.end_card ? "fade" : "fade";
      const d = t && t.type !== "cut" ? t.duration_s : 0.3;
      const out = i === parts.length - 1 ? "[v]" : `[x${i}]`;
      graph += `${prev}[${i}:v]xfade=transition=${type}:duration=${d}:offset=${Math.max(0, offset - d).toFixed(3)}${out};`;
      prev = out;
      offset = offset - d + parts[i].duration;
    }
    if (anyAudio) {
      for (let i = 0; i < parts.length; i++) {
        graph += parts[i].hasAudio ? `[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo[a${i}];` : `anullsrc=r=48000:cl=stereo:d=${parts[i].duration}[a${i}];`;
        audioLabels.push(`[a${i}]`);
      }
      graph += `${audioLabels.join("")}concat=n=${parts.length}:v=0:a=1[a];`;
    }
    graph = graph.replace(/;$/, "");
    await runFfmpeg([...inputs, "-filter_complex", graph, "-map", "[v]", ...(anyAudio ? ["-map", "[a]", ...ENCODE_AAC] : ["-an"]), ...enc, joined], { logName: opts.logName, onProgress: (s) => opts.onProgress?.(60 + Math.min(25, (s / Math.max(1, totalPlanned)) * 25), "Joining clips") });
  }

  // 4. music
  const total = parts.reduce((a, p) => a + p.duration, 0);
  if (tl.music) {
    const m = tl.music;
    const mabs = m.asset_id;
    const fo = Math.max(0, total - m.fade_out_s);
    const musicChain = `[1:a]atrim=start=${m.offset_s}:duration=${total.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${m.fade_in_s},afade=t=out:st=${fo.toFixed(3)}:d=${m.fade_out_s},volume=${m.volume}[m]`;
    let graph = musicChain;
    let map = "[m]";
    if (anyAudio && m.mode !== "replace") {
      graph += m.mode === "duck" ? `;[m][0:a]sidechaincompress=threshold=0.05:ratio=6:attack=20:release=400[md];[0:a][md]amix=inputs=2:duration=first:dropout_transition=2[a]` : `;[0:a][m]amix=inputs=2:duration=first:dropout_transition=2[a]`;
      map = "[a]";
    }
    await runFfmpeg(["-i", joined, "-i", mabs, "-filter_complex", graph, "-map", "0:v", "-map", map, "-c:v", "copy", ...ENCODE_AAC, "-shortest", dest], { logName: opts.logName, onProgress: (s) => opts.onProgress?.(85 + Math.min(14, (s / Math.max(1, total)) * 14), "Mixing music") });
  } else {
    await fs.copyFile(joined, dest);
  }
  await fs.rm(work, { recursive: true, force: true });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const ffmpegRender: HandlerSpec<{ timeline_id: string; preview?: boolean }> = {
  lane: "ffmpeg",
  maxAttempts: 1,
  run: async (ctx) => {
    const row = ctx.db.select().from(timelines).where(eq(timelines.id, ctx.payload.timeline_id)).get();
    if (!row) throw notFound("Timeline");
    const tl = zTimeline.parse(JSON.parse(row.timelineJson));
    const campaign = getCampaign(ctx.db, row.campaignId);
    // Resolve asset ids to absolute paths for the renderer.
    const resolved: Timeline = { ...tl, clips: tl.clips.map((c) => ({ ...c, asset_id: assetAbs(getAsset(ctx.db, c.asset_id)) })), music: tl.music ? { ...tl.music, asset_id: assetAbs(getAsset(ctx.db, tl.music.asset_id)) } : undefined, end_card: tl.end_card ? { ...tl.end_card, logo_asset_id: tl.end_card.logo_asset_id ? assetAbs(getAsset(ctx.db, tl.end_card.logo_asset_id)) : undefined } : undefined };
    ctx.db.update(timelines).set({ status: "rendering", updatedAt: Date.now() }).where(eq(timelines.id, row.id)).run();
    const outDir = projectOutDir(campaign.projectId, "renders");
    await fs.mkdir(outDir, { recursive: true });
    const dest = path.join(outDir, `${row.id}-${ctx.payload.preview ? "preview" : "final"}-${Date.now()}.mp4`);
    try {
      await renderTimeline(resolved, dest, { preview: ctx.payload.preview, onProgress: (pct, msg) => ctx.progress(pct, msg), logName: ctx.job.id });
      const a = await registerAsset(ctx.db, { projectId: campaign.projectId, absFile: dest, role: "render", kind: "video", sourceJobId: ctx.job.id, meta: { timeline_id: row.id, preview: !!ctx.payload.preview }, tags: [ctx.payload.preview ? "preview" : "final"] });
      ctx.db.update(timelines).set({ status: "rendered", ...(ctx.payload.preview ? { previewAssetId: a.id } : { renderAssetId: a.id }), updatedAt: Date.now() }).where(eq(timelines.id, row.id)).run();
      ctx.emit("artifact", { asset_id: a.id, timeline_id: row.id, preview: !!ctx.payload.preview });
      return { asset_id: a.id };
    } catch (err) {
      ctx.db.update(timelines).set({ status: "failed", updatedAt: Date.now() }).where(eq(timelines.id, row.id)).run();
      throw err;
    }
  },
};

export const exportRun: HandlerSpec<{ export_id: string }> = {
  lane: "ffmpeg",
  maxAttempts: 1,
  run: async (ctx) => {
    const ex = ctx.db.select().from(exportsTable).where(eq(exportsTable.id, ctx.payload.export_id)).get();
    if (!ex) throw notFound("Export");
    const ch = channelById(ex.channelId);
    if (!ch) throw new PermanentError(`Unknown channel ${ex.channelId}`);
    const src = getAsset(ctx.db, ex.sourceAssetId);
    const campaign = getCampaign(ctx.db, ex.campaignId);
    const project = getProject(ctx.db, campaign.projectId);
    const params = JSON.parse(ex.paramsJson) as { focal?: { x: number; y: number }; shot_title?: string; version?: number };
    const outDir = projectOutDir(campaign.projectId, "exports", ex.id, ch.id);
    await fs.mkdir(outDir, { recursive: true });
    const name = safeFilename(`${project.name}_${campaign.name}_${params.shot_title ?? src.id}_${ch.id}_v${params.version ?? 1}`);
    ctx.db.update(exportsTable).set({ status: "running" }).where(eq(exportsTable.id, ex.id)).run();
    try {
      let dest: string;
      if (src.kind === "image") {
        if (ch.id === "master") { dest = path.join(outDir, `${name}${path.extname(assetAbs(src))}`); await fs.copyFile(assetAbs(src), dest); }
        else {
          dest = path.join(outDir, `${name}.${ch.format === "png" ? "png" : "jpg"}`);
          await resizeCover(assetAbs(src), dest, ch.width, ch.height, params.focal ?? { x: 0.5, y: 0.5 }, ch.format === "png" ? "png" : "jpg", ch.quality ?? 90);
          if (ch.maxBytes) {
            let q = ch.quality ?? 80;
            while ((await fs.stat(dest)).size > ch.maxBytes && q > 40) { q -= 10; await resizeCover(assetAbs(src), dest, ch.width, ch.height, params.focal ?? { x: 0.5, y: 0.5 }, "jpg", q); }
          }
        }
      } else {
        if (ch.id === "master") { dest = path.join(outDir, `${name}.mp4`); await fs.copyFile(assetAbs(src), dest); }
        else {
          if (ch.kind === "image") throw new PermanentError(`${ch.label} is an image channel; export a still instead.`);
          dest = path.join(outDir, `${name}.mp4`);
          const p = await probe(assetAbs(src));
          const dur = (p.durationMs ?? 0) / 1000;
          const args = ["-i", assetAbs(src), "-vf", normalizeFilter(ch.width, ch.height, "cover", 30, params.focal), ...ENCODE_H264, ...(p.hasAudio ? ENCODE_AAC : ["-an"])];
          if (ch.maxVideoS && dur > ch.maxVideoS) { args.push("-t", String(ch.maxVideoS)); ctx.emit("log", { line: `Trimmed to ${ch.maxVideoS}s for ${ch.label}` }); }
          await runFfmpeg([...args, dest], { logName: ctx.job.id, onProgress: (s) => ctx.progress(Math.min(95, (s / Math.max(1, dur)) * 100), `Exporting ${ch.label}`) });
        }
      }
      const a = await registerAsset(ctx.db, { projectId: campaign.projectId, absFile: dest, role: "export", kind: src.kind as "image" | "video", parentAssetId: src.id, sourceJobId: ctx.job.id, meta: { channel: ch.id, export_id: ex.id }, tags: ["export", ch.id] });
      ctx.db.update(exportsTable).set({ status: "succeeded", assetId: a.id }).where(eq(exportsTable.id, ex.id)).run();
      ctx.emit("artifact", { asset_id: a.id, export_id: ex.id, channel: ch.id });
      return { asset_id: a.id, path: dest };
    } catch (err) {
      ctx.db.update(exportsTable).set({ status: "failed", error: (err as Error).message }).where(eq(exportsTable.id, ex.id)).run();
      throw err;
    }
  },
};
