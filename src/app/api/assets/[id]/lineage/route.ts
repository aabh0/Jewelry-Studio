import { route, json, db } from "@/server/http";
import { lineage } from "@/server/assets";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json({ items: lineage(db(), params.id) }));
