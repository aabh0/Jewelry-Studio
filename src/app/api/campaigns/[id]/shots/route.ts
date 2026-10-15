import { route, json, db, body } from "@/server/http";
import { getCampaign, createShot } from "@/server/campaigns";
import { zShotSpec } from "@/domain/storyboard";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json({ items: getCampaign(db(), params.id).shots }));
export const POST = route<{ id: string }>(async (req, { params }) => { const b = await body(req, z.object({ title: z.string().min(1), spec: zShotSpec })); return json(createShot(db(), params.id, b.title, b.spec), 201); });
