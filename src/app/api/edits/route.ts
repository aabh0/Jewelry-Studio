import { route, json, db, body, wakeWorker } from "@/server/http";
import { edits } from "@/db/schema";
import { newId } from "@/lib/ids";
import { getAsset } from "@/server/assets";
import { enqueue } from "@/queue/enqueue";
import { z } from "zod";
import { eq } from "drizzle-orm";
export const dynamic = "force-dynamic";
export const POST = route(async (req) => {
  const b = await body(req, z.object({ op: z.enum(["refine", "relight", "inpaint", "outpaint", "cutout", "upscale", "crop", "adjust", "reframe", "extend", "object_swap", "video_upscale"]), source_asset_id: z.string(), params: z.record(z.string(), z.unknown()).default({}), mask_asset_id: z.string().optional() }));
  const d = db();
  const src = getAsset(d, b.source_asset_id);
  const id = newId();
  d.insert(edits).values({ id, projectId: src.projectId ?? "global", sourceAssetId: src.id, op: b.op, paramsJson: JSON.stringify(b.params), maskAssetId: b.mask_asset_id ?? null, status: "queued", createdAt: Date.now() }).run();
  const r = enqueue(d, "edit.run", { edit_id: id }, { idempotencyKey: null, projectId: src.projectId ?? undefined, label: `${b.op} · ${src.originalName ?? src.id}` });
  d.update(edits).set({ jobId: r.id }).where(eq(edits.id, id)).run();
  wakeWorker();
  return json({ edit_id: id, job_id: r.id }, 202);
});
