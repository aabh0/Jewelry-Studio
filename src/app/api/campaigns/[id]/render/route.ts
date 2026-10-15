import { route, json, db, body, wakeWorker } from "@/server/http";
import { getTimeline, putTimeline, defaultTimeline, getCampaign } from "@/server/campaigns";
import { enqueue } from "@/queue/enqueue";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (req, { params }) => {
  const b = await body(req, z.object({ preview: z.boolean().default(false) }));
  const c = getCampaign(db(), params.id);
  const t = getTimeline(db(), c.id) ?? putTimeline(db(), c.id, defaultTimeline(db(), c.id));
  const r = enqueue(db(), "ffmpeg.render", { timeline_id: t.id, preview: b.preview }, { idempotencyKey: null, projectId: c.projectId, campaignId: c.id, label: `${b.preview ? "Preview" : "Render"} · ${c.name}` });
  wakeWorker();
  return json({ job_id: r.id, timeline_id: t.id }, 202);
});
