import { route, json, db, wakeWorker } from "@/server/http";
import { enqueue } from "@/queue/enqueue";
export const dynamic = "force-dynamic";
export const POST = route(async () => { const r = enqueue(db(), "provider.probe", {}, { idempotencyKey: null, label: "Provider probe" }); wakeWorker(); return json({ job_id: r.id }, 202); });
