import { route, json, db, body } from "@/server/http";
import { getCampaign, updateCampaign, zCampaignInput } from "@/server/campaigns";
import { zStoryboard } from "@/domain/storyboard";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json(getCampaign(db(), params.id)));
export const PATCH = route<{ id: string }>(async (req, { params }) => json(updateCampaign(db(), params.id, await body(req, zCampaignInput.partial().extend({ status: z.string().optional(), storyboard: zStoryboard.nullable().optional() })))));
export const DELETE = route<{ id: string }>(async (_req, { params }) => json(updateCampaign(db(), params.id, { status: "archived" })));
