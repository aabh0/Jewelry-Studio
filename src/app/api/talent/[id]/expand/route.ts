import { route, json, db, wakeWorker } from "@/server/http";
import { getTalent } from "@/server/talent";
import { enqueue } from "@/queue/enqueue";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (_req, { params }) => { const t = getTalent(db(), params.id); const r = enqueue(db(), "director.talent_expand", { talent_id: t.id }, { idempotencyKey: null, projectId: t.projectId ?? undefined, label: `${t.name} · expand brief` }); wakeWorker(); return json({ job_id: r.id }, 202); });
