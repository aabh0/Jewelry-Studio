import { route, json, db, body, wakeWorker } from "@/server/http";
import { getCampaign, updateCampaign } from "@/server/campaigns";
import { enqueue } from "@/queue/enqueue";
import { badRequest } from "@/server/errors";
import { z } from "zod";
export const dynamic = "force-dynamic";
/** Fan out generation for approved shots. stage: stills | keyframes | clips */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const b = await body(req, z.object({ stage: z.enum(["stills", "keyframes", "clips"]).default("stills"), shot_ids: z.array(z.string()).optional(), variants: z.number().int().min(1).max(8).optional() }));
  const c = getCampaign(db(), params.id);
  const targets = c.shots.filter((s) => (b.shot_ids ? b.shot_ids.includes(s.id) : s.approved === 1) && (b.stage !== "clips" || s.keyframeAssetId));
  if (targets.length === 0) throw badRequest(b.stage === "clips" ? "No approved shots with an approved keyframe." : "No approved shots to generate. Approve shots first.");
  const d = db();
  const children = targets.map((s) => (b.stage === "clips" ? enqueue(d, "gen.video", { shot_id: s.id, variants: b.variants }, { idempotencyKey: null, projectId: c.projectId, campaignId: c.id, label: `Clip · ${s.title}` }).id : enqueue(d, "gen.image", { shot_id: s.id, stage: b.stage, variants: b.variants }, { idempotencyKey: null, projectId: c.projectId, campaignId: c.id, label: `${b.stage === "keyframes" ? "Keyframe" : "Still"} · ${s.title}` }).id));
  const parent = enqueue(d, "fanout.await", { child_ids: children, campaign_id: c.id, on_done_status: "review" }, { idempotencyKey: null, projectId: c.projectId, campaignId: c.id, label: `Generate ${b.stage} · ${c.name}`, priority: -1 });
  updateCampaign(d, c.id, { status: "generating" });
  wakeWorker();
  return json({ parent_job_id: parent.id, child_job_ids: children, count: targets.length }, 202);
});
