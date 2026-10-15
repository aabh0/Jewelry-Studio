import { route, json, db, wakeWorker } from "@/server/http";
import { getCampaign } from "@/server/campaigns";
import { enqueue } from "@/queue/enqueue";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const c = getCampaign(db(), params.id);
  const r = enqueue(db(), "director.storyboard", { campaign_id: c.id }, { idempotencyKey: null, projectId: c.projectId, campaignId: c.id, label: `Storyboard · ${c.name}` });
  wakeWorker();
  return json({ job_id: r.id }, 202);
});
