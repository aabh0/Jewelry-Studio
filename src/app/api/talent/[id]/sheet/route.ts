import { route, json, db, body, wakeWorker } from "@/server/http";
import { getTalent } from "@/server/talent";
import { getAsset, assetAbs } from "@/server/assets";
import { enqueue } from "@/queue/enqueue";
import { cropSheet } from "@/queue/handlers/talent";
import { z } from "zod";
export const dynamic = "force-dynamic";
/** kind=split|turnaround|expressions|hands_ears_neck|outfit. With source_asset_id and crop=true, crops an existing sheet instead of generating. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const b = await body(req, z.object({ kind: z.enum(["split", "turnaround", "expressions", "hands_ears_neck", "outfit"]).default("split"), outfit_id: z.string().optional(), variants: z.number().int().min(1).max(6).optional(), crop_asset_id: z.string().optional() }));
  const t = getTalent(db(), params.id);
  if (b.crop_asset_id) {
    const a = getAsset(db(), b.crop_asset_id);
    const ids = await cropSheet({ db: db() }, t.id, t.projectId, a.id, assetAbs(a), b.kind);
    return json({ cropped: ids });
  }
  const r = enqueue(db(), "talent.sheet", { talent_id: t.id, kind: b.kind, outfit_id: b.outfit_id, variants: b.variants }, { idempotencyKey: null, projectId: t.projectId ?? undefined, label: `${t.name} · ${b.kind} sheet` });
  wakeWorker();
  return json({ job_id: r.id }, 202);
});
