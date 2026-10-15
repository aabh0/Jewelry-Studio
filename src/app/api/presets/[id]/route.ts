import { route, json, db } from "@/server/http";
import { presets } from "@/db/schema";
import { eq } from "drizzle-orm";
export const dynamic = "force-dynamic";
export const DELETE = route<{ id: string }>(async (_req, { params }) => { db().delete(presets).where(eq(presets.id, params.id)).run(); return json({ ok: true }); });
