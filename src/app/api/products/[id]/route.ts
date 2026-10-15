import { route, json, db, body } from "@/server/http";
import { getProduct, updateProduct, deleteProduct, zProductInput } from "@/server/products";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json(getProduct(db(), params.id)));
export const PATCH = route<{ id: string }>(async (req, { params }) => json(updateProduct(db(), params.id, await body(req, zProductInput.partial().extend({ learnedAvoids: z.array(z.string()).optional(), regenerateInvariants: z.boolean().optional() })))));
export const DELETE = route<{ id: string }>(async (_req, { params }) => { deleteProduct(db(), params.id); return json({ ok: true }); });
