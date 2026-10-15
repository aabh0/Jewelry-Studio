import { route, json, db } from "@/server/http";
import { selectCandidate } from "@/server/campaigns";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (_req, { params }) => json(selectCandidate(db(), params.id)));
