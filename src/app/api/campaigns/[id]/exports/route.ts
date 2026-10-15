import { route, json, db, body, wakeWorker } from "@/server/http";
import { createExport, listExports, getCampaign } from "@/server/campaigns";
import { enqueue } from "@/queue/enqueue";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json({ items: listExports(db(), params.id) }));
export const POST = route<{ id: string }>(async (req, { params }) => {
  const b = await body(req, z.object({ channel_ids: z.array(z.string()).min(1), asset_ids: z.array(z.string()).min(1), focal: z.object({ x: z.number(), y: z.number() }).optional(), shot_titles: z.record(z.string(), z.string()).optional() }));
  const c = getCampaign(db(), params.id);
  const jobs: string[] = [];
  for (const ch of b.channel_ids) for (const a of b.asset_ids) {
    const ex = createExport(db(), c.id, ch, a, { focal: b.focal, shot_title: b.shot_titles?.[a] });
    jobs.push(enqueue(db(), "export.run", { export_id: ex.id }, { idempotencyKey: null, projectId: c.projectId, campaignId: c.id, label: `Export ${ch}` }).id);
  }
  wakeWorker();
  return json({ job_ids: jobs }, 202);
});
