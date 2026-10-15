import { route, json, db, body } from "@/server/http";
import { listTalent, createTalent, zTalentInput } from "@/server/talent";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json({ items: listTalent(db(), params.id) }));
export const POST = route<{ id: string }>(async (req, { params }) => json(createTalent(db(), params.id, await body(req, zTalentInput)), 201));
