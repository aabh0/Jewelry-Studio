import { route, json, db, body } from "@/server/http";
import { addOutfitRef } from "@/server/talent";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (req, { params }) => { const b = await body(req, z.object({ assetId: z.string() })); addOutfitRef(db(), params.id, b.assetId); return json({ ok: true }); });
