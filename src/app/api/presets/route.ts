import { route, json, db, body, query } from "@/server/http";
import { presets } from "@/db/schema";
import { newId } from "@/lib/ids";
import { LIGHTING_PRESETS } from "@/domain/lighting";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const GET = route(async (req) => {
  const kind = query(req).get("kind");
  const rows = db().select().from(presets).where(kind ? eq(presets.kind, kind) : undefined).orderBy(desc(presets.createdAt)).all().map((p) => ({ ...p, data: JSON.parse(p.dataJson) }));
  const builtin = (!kind || kind === "lighting") ? Object.entries(LIGHTING_PRESETS).map(([id, p]) => ({ id: `builtin:${id}`, kind: "lighting", name: p.name, description: p.description, data: p.spec, builtin: 1, createdAt: 0 })) : [];
  return json({ items: [...builtin, ...rows] });
});
export const POST = route(async (req) => { const b = await body(req, z.object({ kind: z.string(), name: z.string().min(1), data: z.unknown() })); const id = newId(); db().insert(presets).values({ id, kind: b.kind, name: b.name, dataJson: JSON.stringify(b.data), createdAt: Date.now() }).run(); return json({ id }, 201); });
