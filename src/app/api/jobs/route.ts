import { route, json, db, query, list, num } from "@/server/http";
import { listJobs } from "@/server/jobs";
export const dynamic = "force-dynamic";
export const GET = route(async (req) => { const sp = query(req); return json({ items: listJobs(db(), { status: list(sp, "status"), projectId: sp.get("project_id") ?? undefined, limit: num(sp, "limit") }) }); });
