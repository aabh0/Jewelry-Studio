import { route, json, db, body } from "@/server/http";
import { addProductRef } from "@/server/products";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (req, { params }) => { const b = await body(req, z.object({ assetId: z.string(), role: z.string().default("front"), isPrimary: z.boolean().optional() })); return json(addProductRef(db(), params.id, b.assetId, b.role, b.isPrimary)); });
