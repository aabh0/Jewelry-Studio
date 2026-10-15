import path from "node:path";
import fs from "node:fs/promises";
import type { HandlerSpec } from "@/queue/types";
import { PermanentError } from "@/queue/types";
import { runGeneration, projectOutDir } from "./common";
import { getTalent, addTalentRef, updateTalent, talentReferenceSet } from "@/server/talent";
import { registerAsset, assetAbs } from "@/server/assets";
import { compileCharacterSheet } from "@/domain/prompt/compile";
import { cropToRect } from "@/providers/local/sharp";
import { imageMeta } from "@/providers/local/sharp";
import { env } from "@/env";
import { cliSoulCreate, cliSoulWait, CliError } from "@/providers/higgsfield/cli/adapter";
import { markCliNeedsLogin } from "@/providers/capability";

type SheetKind = "split" | "turnaround" | "expressions" | "hands_ears_neck" | "outfit";

/** Crop layout per sheet kind (fractions of width/height). */
const LAYOUT: Record<SheetKind, { role: string; x: number; y: number; w: number; h: number }[]> = {
  split: [{ role: "full_body", x: 0, y: 0, w: 0.5, h: 1 }, { role: "front", x: 0.5, y: 0, w: 0.5, h: 1 }],
  turnaround: [{ role: "front", x: 0, y: 0, w: 0.25, h: 1 }, { role: "three_quarter", x: 0.25, y: 0, w: 0.25, h: 1 }, { role: "profile", x: 0.5, y: 0, w: 0.25, h: 1 }, { role: "full_body", x: 0.75, y: 0, w: 0.25, h: 1 }],
  expressions: [{ role: "expression", x: 0, y: 0, w: 0.5, h: 1 }],
  hands_ears_neck: [{ role: "hands", x: 0, y: 0, w: 0.5, h: 0.5 }, { role: "ears", x: 0.5, y: 0, w: 0.5, h: 0.5 }, { role: "ears", x: 0, y: 0.5, w: 0.5, h: 0.5 }, { role: "neck", x: 0.5, y: 0.5, w: 0.5, h: 0.5 }],
  outfit: [{ role: "full_body", x: 0, y: 0, w: 0.5, h: 1 }],
};

export const talentSheet: HandlerSpec<{ talent_id: string; kind?: SheetKind; outfit_id?: string; variants?: number; source_asset_id?: string }> = {
  lane: "provider",
  maxAttempts: 2,
  run: async (ctx) => {
    const t = getTalent(ctx.db, ctx.payload.talent_id);
    const kind = ctx.payload.kind ?? "split";
    const outfit = ctx.payload.outfit_id ? t.outfits.find((o) => o.id === ctx.payload.outfit_id)?.spec : undefined;
    const identityRefs = talentReferenceSet(t, undefined, 2).map((r) => r.asset);
    const refs = identityRefs;
    const prompt = compileCharacterSheet(kind, t.spec, t.name, outfit, refs.length > 0);
    const variants = kind === "split" ? (ctx.payload.variants ?? 3) : 1;
    const projectId = t.projectId ?? "global";
    const out = await runGeneration(ctx, {
      capability: "image.character_sheet", kind: "image", prompt, refs, aspect: kind === "hands_ears_neck" ? "1:1" : "16:9", resolution: "2k", count: variants,
      outDir: projectOutDir(projectId, "talent", t.id), outBase: `${ctx.job.id}-${kind}`, projectId: t.projectId, label: `${t.name} ${kind} sheet`,
    });
    const sheetIds: string[] = [];
    for (let i = 0; i < out.files.length; i++) {
      const a = await registerAsset(ctx.db, { projectId: t.projectId, absFile: out.files[i], role: "sheet", kind: "image", sourceJobId: ctx.job.id, providerUrl: out.providerUrls[i], meta: { talent_id: t.id, sheet_kind: kind, index: i }, tags: ["talent-sheet", kind] });
      sheetIds.push(a.id);
      ctx.emit("artifact", { asset_id: a.id, talent_id: t.id, sheet_kind: kind });
      // Non-variant sheets are auto-cropped and attached as references; split variants wait for the owner to pick one (then cropped via talent.sheet with source_asset_id).
      if (variants === 1) await cropSheet(ctx, t.id, t.projectId, a.id, assetAbs(a), kind);
    }
    return { sheet_asset_ids: sheetIds, kind };
  },
};

export async function cropSheet(ctx: { db: import("@/db/client").DB }, talentId: string, projectId: string | null, sheetAssetId: string, sheetAbs: string, kind: SheetKind): Promise<string[]> {
  const m = await imageMeta(sheetAbs);
  const dir = projectOutDir(projectId ?? "global", "talent", talentId, "refs");
  await fs.mkdir(dir, { recursive: true });
  const ids: string[] = [];
  for (const [i, cell] of LAYOUT[kind].entries()) {
    const rect = { left: Math.round(cell.x * m.width), top: Math.round(cell.y * m.height), width: Math.round(cell.w * m.width), height: Math.round(cell.h * m.height) };
    const dest = path.join(dir, `${sheetAssetId}-${kind}-${i}.png`);
    await cropToRect(sheetAbs, dest, rect);
    const a = await registerAsset(ctx.db, { projectId, absFile: dest, role: "talent_ref", kind: "image", parentAssetId: sheetAssetId, meta: { talent_id: talentId, crop_role: cell.role, sheet_kind: kind } });
    addTalentRef(ctx.db, talentId, a.id, cell.role);
    ids.push(a.id);
  }
  return ids;
}

export const talentSoulTrain: HandlerSpec<{ talent_id: string }> = {
  lane: "provider",
  maxAttempts: 1,
  run: async (ctx) => {
    const t = getTalent(ctx.db, ctx.payload.talent_id);
    const refs = t.refs.filter((r) => r.approved === 1 && r.asset.kind === "image");
    if (refs.length < 5) throw new PermanentError("Soul training needs at least 5 approved reference images (generate the character sheets first).");
    if (env.MOCK_PROVIDERS) {
      updateTalent(ctx.db, t.id, { identityMode: "soul_id", soulId: `mock-soul-${t.id}`, soulStatus: "ready" });
      return { soul_id: `mock-soul-${t.id}` };
    }
    updateTalent(ctx.db, t.id, { soulStatus: "training" });
    try {
      ctx.progress(5, "Submitting Soul training");
      const id = await cliSoulCreate(t.name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 24) || "talent", refs.slice(0, 20).map((r) => assetAbs(r.asset)));
      updateTalent(ctx.db, t.id, { soulId: id });
      ctx.checkpoint({ soul_id: id });
      ctx.progress(20, "Training (this takes several minutes)");
      await cliSoulWait(id);
      updateTalent(ctx.db, t.id, { identityMode: "soul_id", soulStatus: "ready" });
      return { soul_id: id };
    } catch (err) {
      updateTalent(ctx.db, t.id, { soulStatus: "failed" });
      if (err instanceof CliError && err.code === "needs_login") { markCliNeedsLogin(); throw new PermanentError(err.message, "needs_login"); }
      throw err;
    }
  },
};
