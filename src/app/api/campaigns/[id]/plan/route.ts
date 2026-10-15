import { route, json, db, body, wakeWorker } from "@/server/http";
import { getCampaign } from "@/server/campaigns";
import { enqueue } from "@/queue/enqueue";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (req, { params }) => {
  const b = await body(req, z.object({ count: z.number().int().min(1).max(24).optional() }));
  const c = getCampaign(db(), params.id);
  const r = enqueue(db(), "director.shot_list", { campaign_id: c.id, count: b.count }, { idempotencyKey: null, projectId: c.projectId, campaignId: c.id, label: `Plan shots · ${c.name}` });
  wakeWorker();
  return json({ job_id: r.id }, 202);
});
