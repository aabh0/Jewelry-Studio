import { route, json, db } from "@/server/http";
import { edits } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "@/server/errors";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => { const e = db().select().from(edits).where(eq(edits.id, params.id)).get(); if (!e) throw notFound("Edit"); return json({ ...e, params: JSON.parse(e.paramsJson) }); });
