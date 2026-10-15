import { route, json, db, body } from "@/server/http";
import { getAsset, updateAsset, trashAsset, assetTagsFor, setAssetTags } from "@/server/assets";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => { const a = getAsset(db(), params.id); return json({ ...a, tags: assetTagsFor(db(), a.id) }); });
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const b = await body(req, z.object({ note: z.string().nullable().optional(), tags: z.array(z.string()).optional(), meta: z.record(z.string(), z.unknown()).optional() }));
  if (b.tags) setAssetTags(db(), params.id, b.tags);
  const a = updateAsset(db(), params.id, { note: b.note, meta: b.meta });
  return json({ ...a, tags: assetTagsFor(db(), a.id) });
});
export const DELETE = route<{ id: string }>(async (_req, { params }) => { await trashAsset(db(), params.id); return json({ ok: true }); });
