import path from "node:path";
import fs from "node:fs/promises";
import { eq, inArray } from "drizzle-orm";
import type { HandlerSpec } from "@/queue/types";
import { PermanentError } from "@/queue/types";
import * as s from "@/db/schema";
import { dirs, absPath, sha256File } from "@/lib/files";
import { newId } from "@/lib/ids";
import { getProject } from "@/server/projects";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

/** Export a project as a folder bundle (manifest + json dump + media tree) and zip it with the system zip when available. */
export const projectExportBundle: HandlerSpec<{ project_id: string }> = {
  lane: "local",
  maxAttempts: 1,
  run: async (ctx) => {
    const db = ctx.db;
    const p = getProject(db, ctx.payload.project_id);
    const stamp = Date.now();
    const outDir = path.join(dirs.root(), "bundles", `${p.id}-${stamp}`);
    await fs.mkdir(path.join(outDir, "media"), { recursive: true });
    const rows: Record<string, unknown[]> = {};
    rows.projects = db.select().from(s.projects).where(eq(s.projects.id, p.id)).all();
    rows.products = db.select().from(s.products).where(eq(s.products.projectId, p.id)).all();
    rows.talent = db.select().from(s.talent).where(eq(s.talent.projectId, p.id)).all();
    rows.campaigns = db.select().from(s.campaigns).where(eq(s.campaigns.projectId, p.id)).all();
    const campaignIds = (rows.campaigns as { id: string }[]).map((c) => c.id).concat(["_"]);
    const productIds = (rows.products as { id: string }[]).map((c) => c.id).concat(["_"]);
    const talentIds = (rows.talent as { id: string }[]).map((c) => c.id).concat(["_"]);
    rows.product_refs = db.select().from(s.productRefs).where(inArray(s.productRefs.productId, productIds)).all();
    rows.talent_refs = db.select().from(s.talentRefs).where(inArray(s.talentRefs.talentId, talentIds)).all();
    rows.outfits = db.select().from(s.outfits).where(inArray(s.outfits.talentId, talentIds)).all();
    const outfitIds = (rows.outfits as { id: string }[]).map((o) => o.id).concat(["_"]);
    rows.outfit_refs = db.select().from(s.outfitRefs).where(inArray(s.outfitRefs.outfitId, outfitIds)).all();
    rows.campaign_products = db.select().from(s.campaignProducts).where(inArray(s.campaignProducts.campaignId, campaignIds)).all();
    rows.campaign_talent = db.select().from(s.campaignTalent).where(inArray(s.campaignTalent.campaignId, campaignIds)).all();
    rows.campaign_refs = db.select().from(s.campaignRefs).where(inArray(s.campaignRefs.campaignId, campaignIds)).all();
    rows.shots = db.select().from(s.shots).where(inArray(s.shots.campaignId, campaignIds)).all();
    const shotIds = (rows.shots as { id: string }[]).map((c) => c.id).concat(["_"]);
    rows.generations = db.select().from(s.generations).where(inArray(s.generations.shotId, shotIds)).all();
    rows.candidates = db.select().from(s.candidates).where(inArray(s.candidates.shotId, shotIds)).all();
    rows.timelines = db.select().from(s.timelines).where(inArray(s.timelines.campaignId, campaignIds)).all();
    rows.exports = db.select().from(s.exportsTable).where(inArray(s.exportsTable.campaignId, campaignIds)).all();
    rows.edits = db.select().from(s.edits).where(eq(s.edits.projectId, p.id)).all();
    rows.assets = db.select().from(s.assets).where(eq(s.assets.projectId, p.id)).all();
    const assetIds = (rows.assets as { id: string }[]).map((a) => a.id).concat(["_"]);
    rows.asset_tags = db.select().from(s.assetTags).where(inArray(s.assetTags.assetId, assetIds)).all();
    const files: { rel: string; sha256: string }[] = [];
    for (const [i, a] of (rows.assets as { pathRel: string; sha256: string; deletedAt: number | null }[]).entries()) {
      if (a.deletedAt) continue;
      const src = absPath(a.pathRel);
      const dest = path.join(outDir, "media", a.pathRel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      try { await fs.copyFile(src, dest); files.push({ rel: a.pathRel, sha256: a.sha256 }); } catch { ctx.emit("log", { line: `missing file ${a.pathRel}` }); }
      if (i % 20 === 0) ctx.progress((i / Math.max(1, assetIds.length)) * 90, `Copying media ${i}/${assetIds.length}`);
    }
    await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify({ schema: 1, app: "jewelry-studio", exported_at: new Date().toISOString(), project_id: p.id, project_name: p.name, files }, null, 2));
    await fs.writeFile(path.join(outDir, "data.json"), JSON.stringify(rows));
    let zipPath: string | null = null;
    try {
      zipPath = `${outDir}.jsbundle.zip`;
      await execFileP("zip", ["-r", "-q", zipPath, path.basename(outDir)], { cwd: path.dirname(outDir) });
      await fs.rm(outDir, { recursive: true, force: true });
    } catch { zipPath = null; }
    return { path: zipPath ?? outDir, zipped: !!zipPath };
  },
};

/** Import a bundle folder (unzipped) with new ids. */
export const projectImportBundle: HandlerSpec<{ bundle_dir: string }> = {
  lane: "local",
  maxAttempts: 1,
  run: async (ctx) => {
    const db = ctx.db;
    const dir = ctx.payload.bundle_dir;
    const manifest = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8")) as { schema: number; files: { rel: string; sha256: string }[]; project_name: string };
    if (manifest.schema !== 1) throw new PermanentError("Unsupported bundle schema");
    const rows = JSON.parse(await fs.readFile(path.join(dir, "data.json"), "utf8")) as Record<string, Record<string, unknown>[]>;
    const idMap = new Map<string, string>();
    const map = (id: unknown) => (typeof id === "string" && idMap.has(id) ? idMap.get(id)! : id);
    const remap = <T extends Record<string, unknown>>(r: T, keys: string[]): T => { const o = { ...r } as Record<string, unknown>; for (const k of keys) if (o[k] !== undefined && o[k] !== null) o[k] = map(o[k]); return o as T; };
    for (const table of ["projects", "assets", "products", "talent", "outfits", "campaigns", "shots", "generations", "candidates", "timelines", "exports", "edits"]) for (const r of rows[table] ?? []) idMap.set(r.id as string, newId());
    const newProjectId = idMap.get((rows.projects[0] as { id: string }).id)!;
    const missing: string[] = [];
    // media first
    for (const a of rows.assets) {
      const rel = a.pathRel as string;
      const src = path.join(dir, "media", rel);
      const newRel = rel.replace((rows.projects[0] as { id: string }).id, newProjectId);
      const dest = absPath(newRel);
      try {
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
        const sha = await sha256File(dest);
        if (sha !== a.sha256) missing.push(`${rel} (checksum mismatch)`);
      } catch { missing.push(rel); }
      a.pathRel = newRel;
    }
    const ins = (table: keyof typeof s, data: Record<string, unknown>[]) => { for (const r of data) db.insert(s[table] as never).values(r as never).onConflictDoNothing().run(); };
    ins("projects", rows.projects.map((r) => ({ ...remap(r, ["id", "coverAssetId"]), name: `${r.name} (imported)` })));
    ins("assets", rows.assets.map((r) => remap(r, ["id", "projectId", "parentAssetId", "sourceJobId"])));
    ins("assetTags", (rows.asset_tags ?? []).map((r) => remap(r, ["assetId"])));
    ins("products", rows.products.map((r) => remap(r, ["id", "projectId"])));
    ins("productRefs", (rows.product_refs ?? []).map((r) => remap(r, ["productId", "assetId"])));
    ins("talent", rows.talent.map((r) => remap(r, ["id", "projectId"])));
    ins("talentRefs", (rows.talent_refs ?? []).map((r) => remap(r, ["talentId", "assetId"])));
    ins("outfits", (rows.outfits ?? []).map((r) => remap(r, ["id", "talentId"])));
    ins("outfitRefs", (rows.outfit_refs ?? []).map((r) => remap(r, ["outfitId", "assetId"])));
    ins("campaigns", rows.campaigns.map((r) => remap(r, ["id", "projectId"])));
    ins("campaignProducts", (rows.campaign_products ?? []).map((r) => remap(r, ["campaignId", "productId"])));
    ins("campaignTalent", (rows.campaign_talent ?? []).map((r) => remap(r, ["campaignId", "talentId", "outfitId"])));
    ins("campaignRefs", (rows.campaign_refs ?? []).map((r) => remap(r, ["campaignId", "assetId"])));
    ins("shots", rows.shots.map((r) => remap(r, ["id", "campaignId", "selectedAssetId", "keyframeAssetId", "clipAssetId"])));
    ins("generations", (rows.generations ?? []).map((r) => remap(r, ["id", "shotId"])));
    ins("candidates", (rows.candidates ?? []).map((r) => remap(r, ["id", "generationId", "shotId", "assetId"])));
    ins("timelines", (rows.timelines ?? []).map((r) => remap(r, ["id", "campaignId", "renderAssetId", "previewAssetId"])));
    ins("exportsTable", (rows.exports ?? []).map((r) => remap(r, ["id", "campaignId", "sourceAssetId", "assetId"])));
    ins("edits", (rows.edits ?? []).map((r) => remap(r, ["id", "projectId", "sourceAssetId", "resultAssetId", "maskAssetId"])));
    return { project_id: newProjectId, missing };
  },
};
