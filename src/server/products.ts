import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { products, productRefs, assets } from "@/db/schema";
import { newId } from "@/lib/ids";
import { zProductSpec, normalizeProductSpec, deriveInvariants, validateProductSpec, type ProductSpec } from "@/domain/product";
import { notFound, badRequest } from "./errors";
import type { AssetRow } from "./assets";

export const zProductInput = z.object({
  name: z.string().min(1).max(120),
  sku: z.string().max(80).optional().nullable(),
  spec: zProductSpec,
  invariants: z.array(z.string()).optional(),
  notes: z.string().max(8000).optional().nullable(),
});

export const PRODUCT_REF_ROLES = ["front", "three_quarter", "profile", "back", "macro", "worn", "packaging", "plate", "sheet", "other"] as const;

export function listProducts(db: DB, projectId: string) {
  return db.select().from(products).where(eq(products.projectId, projectId)).orderBy(asc(products.createdAt)).all().map((p) => hydrate(db, p));
}

function hydrate(db: DB, p: typeof products.$inferSelect) {
  const refs = db
    .select({ assetId: productRefs.assetId, role: productRefs.role, isPrimary: productRefs.isPrimary, approved: productRefs.approved, order: productRefs.order, asset: assets })
    .from(productRefs)
    .innerJoin(assets, eq(assets.id, productRefs.assetId))
    .where(eq(productRefs.productId, p.id))
    .orderBy(asc(productRefs.order))
    .all();
  const spec = zProductSpec.parse(JSON.parse(p.specJson));
  return { ...p, spec, invariants: JSON.parse(p.invariantsJson) as string[], learnedAvoids: JSON.parse(p.learnedAvoidsJson) as string[], refs: refs.filter((r) => !r.asset.deletedAt), validation: validateProductSpec(spec) };
}
export type ProductView = ReturnType<typeof hydrate>;

export function getProduct(db: DB, id: string): ProductView {
  const p = db.select().from(products).where(eq(products.id, id)).get();
  if (!p) throw notFound("Product");
  return hydrate(db, p);
}

export function createProduct(db: DB, projectId: string, input: z.infer<typeof zProductInput>): ProductView {
  const spec = normalizeProductSpec(input.spec);
  const v = validateProductSpec(spec);
  if (v.errors.length) throw badRequest(v.errors.join(" "), v);
  const id = newId();
  const now = Date.now();
  db.insert(products).values({ id, projectId, name: input.name, sku: input.sku ?? null, specJson: JSON.stringify(spec), invariantsJson: JSON.stringify(input.invariants ?? deriveInvariants(spec)), notes: input.notes ?? null, createdAt: now, updatedAt: now }).run();
  return getProduct(db, id);
}

export function updateProduct(db: DB, id: string, patch: Partial<z.infer<typeof zProductInput>> & { learnedAvoids?: string[]; regenerateInvariants?: boolean }): ProductView {
  const cur = getProduct(db, id);
  let spec: ProductSpec = cur.spec;
  if (patch.spec) {
    spec = normalizeProductSpec(patch.spec);
    const v = validateProductSpec(spec);
    if (v.errors.length) throw badRequest(v.errors.join(" "), v);
  }
  const invariants = patch.invariants ?? (patch.regenerateInvariants || (patch.spec && !patch.invariants) ? deriveInvariants(spec) : cur.invariants);
  db.update(products)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.sku !== undefined ? { sku: patch.sku } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      specJson: JSON.stringify(spec),
      invariantsJson: JSON.stringify(invariants),
      ...(patch.learnedAvoids ? { learnedAvoidsJson: JSON.stringify(patch.learnedAvoids.slice(0, 8)) } : {}),
      updatedAt: Date.now(),
    })
    .where(eq(products.id, id))
    .run();
  return getProduct(db, id);
}

export function addProductRef(db: DB, productId: string, assetId: string, role: string, isPrimary = false): ProductView {
  const p = getProduct(db, productId);
  if (!PRODUCT_REF_ROLES.includes(role as never)) throw badRequest(`Invalid ref role ${role}`);
  const order = p.refs.length;
  if (isPrimary) db.update(productRefs).set({ isPrimary: 0 }).where(eq(productRefs.productId, productId)).run();
  const makePrimary = isPrimary || p.refs.filter((r) => r.role !== "plate" && r.role !== "sheet").length === 0;
  db.insert(productRefs).values({ productId, assetId, role, isPrimary: makePrimary ? 1 : 0, approved: 1, order }).onConflictDoUpdate({ target: [productRefs.productId, productRefs.assetId], set: { role, isPrimary: makePrimary ? 1 : 0 } }).run();
  return getProduct(db, productId);
}

export function updateProductRef(db: DB, productId: string, assetId: string, patch: { role?: string; isPrimary?: boolean; approved?: boolean; order?: number }): ProductView {
  if (patch.isPrimary) db.update(productRefs).set({ isPrimary: 0 }).where(eq(productRefs.productId, productId)).run();
  db.update(productRefs)
    .set({ ...(patch.role ? { role: patch.role } : {}), ...(patch.isPrimary !== undefined ? { isPrimary: patch.isPrimary ? 1 : 0 } : {}), ...(patch.approved !== undefined ? { approved: patch.approved ? 1 : 0 } : {}), ...(patch.order !== undefined ? { order: patch.order } : {}) })
    .where(and(eq(productRefs.productId, productId), eq(productRefs.assetId, assetId)))
    .run();
  return getProduct(db, productId);
}

export function removeProductRef(db: DB, productId: string, assetId: string): ProductView {
  db.delete(productRefs).where(and(eq(productRefs.productId, productId), eq(productRefs.assetId, assetId))).run();
  return getProduct(db, productId);
}

/** Ordered reference set used for generation: plate (if any) → primary upload → other angles → approved sheet frames → macro. Max n. */
export function productReferenceSet(p: ProductView, max = 6): { asset: AssetRow; role: "product_primary" | "product_angle" | "product_macro" | "product_sheet" }[] {
  const approved = p.refs.filter((r) => r.approved === 1);
  const out: { asset: AssetRow; role: "product_primary" | "product_angle" | "product_macro" | "product_sheet" }[] = [];
  const plate = approved.find((r) => r.role === "plate");
  const primary = approved.find((r) => r.isPrimary === 1 && r.role !== "plate" && r.role !== "sheet") ?? approved.find((r) => r.role === "front") ?? approved.find((r) => !["plate", "sheet", "macro", "packaging"].includes(r.role));
  if (plate) out.push({ asset: plate.asset, role: "product_primary" });
  if (primary) out.push({ asset: primary.asset, role: plate ? "product_angle" : "product_primary" });
  for (const r of approved) {
    if (out.some((o) => o.asset.id === r.asset.id)) continue;
    if (["front", "three_quarter", "profile", "back", "worn", "other"].includes(r.role)) out.push({ asset: r.asset, role: "product_angle" });
  }
  for (const r of approved) if (r.role === "sheet" && !out.some((o) => o.asset.id === r.asset.id)) out.push({ asset: r.asset, role: "product_sheet" });
  for (const r of approved) if (r.role === "macro" && !out.some((o) => o.asset.id === r.asset.id)) out.push({ asset: r.asset, role: "product_macro" });
  return out.slice(0, max);
}

export function deleteProduct(db: DB, id: string): void {
  db.delete(productRefs).where(eq(productRefs.productId, id)).run();
  db.delete(products).where(eq(products.id, id)).run();
}
