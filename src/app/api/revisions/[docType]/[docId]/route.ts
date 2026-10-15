import { route, json, db } from "@/server/http";
import { listRevisions } from "@/server/campaigns";
export const dynamic = "force-dynamic";
export const GET = route<{ docType: string; docId: string }>(async (_req, { params }) => json({ items: listRevisions(db(), params.docType, params.docId) }));
