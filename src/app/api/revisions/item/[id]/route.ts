import { route, json, db } from "@/server/http";
import { getRevision } from "@/server/campaigns";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json({ data: getRevision(db(), params.id) }));
