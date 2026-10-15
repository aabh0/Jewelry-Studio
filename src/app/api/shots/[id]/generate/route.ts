import { route, json, db, body, wakeWorker } from "@/server/http";
import { getShot, getCampaign } from "@/server/campaigns";
import { enqueue } from "@/queue/enqueue";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (req, { params }) => {
  const b = await body(req, z.object({ stage: z.enum(["stills", "keyframes", "clips"]).optional(), variants: z.number().int().min(1).max(8).optional(), capability: z.string().optional(), impl_id: z.string().optional(), seed: z.number().int().optional(), mode: z.enum(["auto", "i2v", "r2v", "flf", "preset"]).optional() }));
  const s = getShot(db(), params.id);
  const c = getCampaign(db(), s.campaignId);
  const stage = b.stage ?? (c.kind === "video" ? (s.keyframeAssetId ? "clips" : "keyframes") : "stills");
  const r = stage === "clips"
    ? enqueue(db(), "gen.video", { shot_id: s.id, variants: b.variants, capability: b.capability, impl_id: b.impl_id, mode: b.mode, seed: b.seed }, { idempotencyKey: null, projectId: c.projectId, campaignId: c.id, label: `Clip · ${s.title}` })
    : enqueue(db(), "gen.image", { shot_id: s.id, stage, variants: b.variants, capability: b.capability, impl_id: b.impl_id, seed: b.seed }, { idempotencyKey: null, projectId: c.projectId, campaignId: c.id, label: `${stage === "keyframes" ? "Keyframe" : "Still"} · ${s.title}` });
  wakeWorker();
  return json({ job_id: r.id, stage }, 202);
});
