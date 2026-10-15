import { route, json, db, body } from "@/server/http";
import { addTalentRef } from "@/server/talent";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (req, { params }) => { const b = await body(req, z.object({ assetId: z.string(), role: z.string().default("upload") })); return json(addTalentRef(db(), params.id, b.assetId, b.role)); });
