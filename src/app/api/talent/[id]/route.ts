import { route, json, db, body } from "@/server/http";
import { getTalent, updateTalent, deleteTalent, zTalentInput } from "@/server/talent";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json(getTalent(db(), params.id)));
export const PATCH = route<{ id: string }>(async (req, { params }) => json(updateTalent(db(), params.id, await body(req, zTalentInput.partial().extend({ identityMode: z.enum(["reference_pack", "soul_id"]).optional() })))));
export const DELETE = route<{ id: string }>(async (_req, { params }) => { deleteTalent(db(), params.id); return json({ ok: true }); });
