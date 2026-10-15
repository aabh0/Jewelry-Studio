import { route, json, db, body } from "@/server/http";
import { getCandidate, reviewCandidate } from "@/server/campaigns";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json(getCandidate(db(), params.id)));
export const PATCH = route<{ id: string }>(async (req, { params }) => { const b = await body(req, z.object({ review: z.enum(["unreviewed", "approved", "rejected", "flagged", "maybe"]), note: z.string().optional() })); return json(reviewCandidate(db(), params.id, b.review, b.note)); });
