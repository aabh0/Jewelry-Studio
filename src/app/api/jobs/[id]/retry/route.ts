import { route, json, db, wakeWorker } from "@/server/http";
import { retryJob } from "@/queue/enqueue";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (_req, { params }) => { const ok = retryJob(db(), params.id); wakeWorker(); return json({ ok }); });
