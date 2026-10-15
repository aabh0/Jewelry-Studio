import path from "node:path";
import type { HandlerSpec } from "@/queue/types";
import { PermanentError } from "@/queue/types";
import { runGeneration, projectOutDir } from "./common";
import { getProduct, addProductRef, productReferenceSet } from "@/server/products";
import { registerAsset, assetAbs, getAsset } from "@/server/assets";
import { compileCleanPlate } from "@/domain/prompt/compile";
import { env } from "@/env";
import { laneStatus } from "@/providers/capability";
import fs from "node:fs/promises";

export const productCleanPlate: HandlerSpec<{ product_id: string; asset_id?: string }> = {
  lane: "provider",
  maxAttempts: 2,
  run: async (ctx) => {
    const p = getProduct(ctx.db, ctx.payload.product_id);
    const src = ctx.payload.asset_id ? getAsset(ctx.db, ctx.payload.asset_id) : productReferenceSet(p, 1)[0]?.asset;
    if (!src) throw new PermanentError("Product has no reference image to make a plate from.");
    const status = await laneStatus();
    // Prefer true cutout when the CLI is available; otherwise a clean plate re-render (API-only path).
    const useCutout = status.cli.available && !env.MOCK_PROVIDERS;
    const out = await runGeneration(ctx, {
      capability: useCutout ? "image.cutout" : "image.clean_plate", kind: "image",
      prompt: useCutout ? "" : compileCleanPlate("plate", { spec: p.spec, invariants: p.invariants }),
      refs: [src], aspect: "1:1", resolution: "2k", count: 1,
      outDir: projectOutDir(p.projectId, "products", p.id, "plates"), outBase: `${ctx.job.id}-plate`, projectId: p.projectId, label: `${p.name} plate`,
    });
    const a = await registerAsset(ctx.db, { projectId: p.projectId, absFile: out.files[0], role: "plate", kind: "image", sourceJobId: ctx.job.id, parentAssetId: src.id, providerUrl: out.providerUrls[0], meta: { product_id: p.id, kind: useCutout ? "cutout" : "clean_plate" } });
    addProductRef(ctx.db, p.id, a.id, "plate");
    ctx.emit("artifact", { asset_id: a.id, product_id: p.id, role: "plate" });
    return { asset_id: a.id };
  },
};

export const productSheet: HandlerSpec<{ product_id: string; views?: ("hero" | "front" | "profile" | "macro")[] }> = {
  lane: "provider",
  maxAttempts: 2,
  run: async (ctx) => {
    const p = getProduct(ctx.db, ctx.payload.product_id);
    const refs = productReferenceSet(p, 4).map((r) => r.asset);
    if (refs.length === 0) throw new PermanentError("Add at least one product reference image before generating a sheet.");
    const views = ctx.payload.views ?? ["hero", "front", "profile", "macro"];
    const ids: string[] = [];
    const outDir = projectOutDir(p.projectId, "products", p.id, "plates");
    await fs.mkdir(outDir, { recursive: true });
    for (let i = 0; i < views.length; i++) {
      if (ctx.isCancelled()) break;
      const view = views[i];
      ctx.progress((i / views.length) * 100, `Sheet view ${view}`);
      const out = await runGeneration(ctx, {
        capability: "image.product_sheet", kind: "image", prompt: compileCleanPlate(view, { spec: p.spec, invariants: p.invariants }), refs, aspect: "1:1", resolution: "2k", count: 1,
        outDir, outBase: `${ctx.job.id}-${view}`, projectId: p.projectId, label: `${p.name} ${view}`,
      });
      const a = await registerAsset(ctx.db, { projectId: p.projectId, absFile: out.files[0], role: "sheet", kind: "image", sourceJobId: ctx.job.id, providerUrl: out.providerUrls[0], meta: { product_id: p.id, view }, tags: ["sheet", view] });
      addProductRef(ctx.db, p.id, a.id, "sheet");
      ids.push(a.id);
      ctx.emit("artifact", { asset_id: a.id, product_id: p.id, role: "sheet", view });
    }
    return { asset_ids: ids };
  },
};

export { assetAbs, path };
