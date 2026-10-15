import { route, json, db, body } from "@/server/http";
import { createOutfit } from "@/server/talent";
import { zOutfitSpec } from "@/domain/talent";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (req, { params }) => { const b = await body(req, z.object({ name: z.string().min(1), spec: zOutfitSpec })); return json(createOutfit(db(), params.id, b.name, b.spec), 201); });
