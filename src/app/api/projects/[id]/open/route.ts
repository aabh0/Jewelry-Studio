import { route, json, db } from "@/server/http";
import { touchProject } from "@/server/projects";
import { setUiState } from "@/server/settings";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (_req, { params }) => { touchProject(db(), params.id); setUiState(db(), "global", { last_project_id: params.id }); return json({ ok: true }); });
