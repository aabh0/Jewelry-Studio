import { route, json, db, wakeWorker } from "@/server/http";
import { enqueue } from "@/queue/enqueue";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (_req, { params }) => { const r = enqueue(db(), "project.export_bundle", { project_id: params.id }, { idempotencyKey: null, projectId: params.id, label: "Export bundle" }); wakeWorker(); return json({ job_id: r.id }, 202); });
