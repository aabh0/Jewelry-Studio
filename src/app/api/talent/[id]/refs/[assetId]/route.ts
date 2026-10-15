import { route, json, db, body } from "@/server/http";
import { updateTalentRef, removeTalentRef } from "@/server/talent";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const PATCH = route<{ id: string; assetId: string }>(async (req, { params }) => json(updateTalentRef(db(), params.id, params.assetId, await body(req, z.object({ role: z.string().optional(), approved: z.boolean().optional() })))));
export const DELETE = route<{ id: string; assetId: string }>(async (_req, { params }) => json(removeTalentRef(db(), params.id, params.assetId)));
