import { route, json, db } from "@/server/http";
import { requestCancel } from "@/queue/enqueue";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (_req, { params }) => json({ ok: requestCancel(db(), params.id) }));
