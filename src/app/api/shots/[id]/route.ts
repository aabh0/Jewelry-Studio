import { route, json, db, body } from "@/server/http";
import { getShot, updateShot, deleteShot } from "@/server/campaigns";
import { zShotSpec } from "@/domain/storyboard";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json(getShot(db(), params.id)));
export const PATCH = route<{ id: string }>(async (req, { params }) => json(updateShot(db(), params.id, await body(req, z.object({ title: z.string().optional(), spec: zShotSpec.partial().optional(), approved: z.boolean().optional(), order: z.number().optional(), status: z.string().optional(), selectedAssetId: z.string().nullable().optional(), keyframeAssetId: z.string().nullable().optional(), clipAssetId: z.string().nullable().optional() })))));
export const DELETE = route<{ id: string }>(async (_req, { params }) => { deleteShot(db(), params.id); return json({ ok: true }); });
