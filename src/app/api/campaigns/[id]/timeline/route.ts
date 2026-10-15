import { route, json, db, body } from "@/server/http";
import { getTimeline, putTimeline, defaultTimeline } from "@/server/campaigns";
import { zTimeline } from "@/domain/timeline";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => { const t = getTimeline(db(), params.id); return json(t ?? { id: null, campaignId: params.id, timeline: defaultTimeline(db(), params.id), status: "draft", renderAssetId: null, previewAssetId: null }); });
export const PUT = route<{ id: string }>(async (req, { params }) => json(putTimeline(db(), params.id, await body(req, zTimeline))));
