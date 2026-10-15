import { route, json, db, body } from "@/server/http";
import { updateOutfit, deleteOutfit } from "@/server/talent";
import { zOutfitSpec } from "@/domain/talent";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const PATCH = route<{ id: string }>(async (req, { params }) => { updateOutfit(db(), params.id, await body(req, z.object({ name: z.string().optional(), spec: zOutfitSpec.optional() }))); return json({ ok: true }); });
export const DELETE = route<{ id: string }>(async (_req, { params }) => { deleteOutfit(db(), params.id); return json({ ok: true }); });
