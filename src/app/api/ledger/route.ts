import { route, json, db, query, num } from "@/server/http";
import { ledgerRows } from "@/server/settings";
export const dynamic = "force-dynamic";
export const GET = route(async (req) => { const sp = query(req); return json({ items: ledgerRows(db(), { projectId: sp.get("project_id") ?? undefined, from: num(sp, "from"), to: num(sp, "to"), limit: num(sp, "limit") }) }); });
