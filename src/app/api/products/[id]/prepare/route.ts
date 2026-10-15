import { route, json, db, body, wakeWorker } from "@/server/http";
import { getProduct } from "@/server/products";
import { enqueue } from "@/queue/enqueue";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (req, { params }) => {
  const b = await body(req, z.object({ plate: z.boolean().default(true), sheet: z.boolean().default(true), assetId: z.string().optional() }));
  const p = getProduct(db(), params.id);
  const ids: Record<string, string> = {};
  if (b.plate) ids.plate = enqueue(db(), "product.clean_plate", { product_id: p.id, asset_id: b.assetId }, { idempotencyKey: null, projectId: p.projectId, label: `Clean plate · ${p.name}` }).id;
  if (b.sheet) ids.sheet = enqueue(db(), "product.sheet", { product_id: p.id }, { idempotencyKey: null, projectId: p.projectId, label: `Product sheet · ${p.name}` }).id;
  wakeWorker();
  return json({ jobs: ids }, 202);
});
