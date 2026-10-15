import { route, json, db, body } from "@/server/http";
import { getUiState, setUiState } from "@/server/settings";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const GET = route<{ scope: string }>(async (_req, { params }) => json({ data: getUiState(db(), decodeURIComponent(params.scope)) }));
export const PUT = route<{ scope: string }>(async (req, { params }) => { const b = await body(req, z.object({ data: z.unknown(), merge: z.boolean().default(true) })); return json({ data: setUiState(db(), decodeURIComponent(params.scope), b.data, b.merge) }); });
