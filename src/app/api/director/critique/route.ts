import { route, json, db, body, wakeWorker } from "@/server/http";
import { enqueue } from "@/queue/enqueue";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const POST = route(async (req) => { const b = await body(req, z.object({ candidate_id: z.string(), question: z.string().optional() })); const r = enqueue(db(), "director.critique", b, { idempotencyKey: null, label: "Critique" }); wakeWorker(); return json({ job_id: r.id }, 202); });
