import { route, json, db, wakeWorker } from "@/server/http";
import { getTalent } from "@/server/talent";
import { enqueue } from "@/queue/enqueue";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (_req, { params }) => { const t = getTalent(db(), params.id); const r = enqueue(db(), "talent.soul_train", { talent_id: t.id }, { idempotencyKey: null, projectId: t.projectId ?? undefined, label: `${t.name} · Soul training` }); wakeWorker(); return json({ job_id: r.id }, 202); });
