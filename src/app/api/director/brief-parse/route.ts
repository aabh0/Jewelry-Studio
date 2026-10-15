import { route, json, db, body, wakeWorker } from "@/server/http";
import { enqueue } from "@/queue/enqueue";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const POST = route(async (req) => { const b = await body(req, z.object({ campaign_id: z.string(), text: z.string().min(1) })); const r = enqueue(db(), "director.brief_parse", b, { idempotencyKey: null, campaignId: b.campaign_id, label: "Parse brief" }); wakeWorker(); return json({ job_id: r.id }, 202); });
