import { route, json, db, body } from "@/server/http";
import { updateProductRef, removeProductRef } from "@/server/products";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const PATCH = route<{ id: string; assetId: string }>(async (req, { params }) => json(updateProductRef(db(), params.id, params.assetId, await body(req, z.object({ role: z.string().optional(), isPrimary: z.boolean().optional(), approved: z.boolean().optional(), order: z.number().optional() })))));
export const DELETE = route<{ id: string; assetId: string }>(async (_req, { params }) => json(removeProductRef(db(), params.id, params.assetId)));
