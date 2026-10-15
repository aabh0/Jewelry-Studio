import { route, json, db, body } from "@/server/http";
import { listCampaigns, createCampaign, zCampaignInput } from "@/server/campaigns";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json({ items: listCampaigns(db(), params.id) }));
export const POST = route<{ id: string }>(async (req, { params }) => json(createCampaign(db(), params.id, await body(req, zCampaignInput)), 201));
