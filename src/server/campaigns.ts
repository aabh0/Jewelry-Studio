import { eq, and, asc, desc, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { campaigns, campaignProducts, campaignTalent, campaignRefs, shots, generations, candidates, reviewsLog, assets, docRevisions, timelines, exportsTable } from "@/db/schema";
import { newId } from "@/lib/ids";
import { zCampaignBrief, zCampaignSettings, zShotSpec, zStoryboard, type ShotSpec, type Storyboard, zQAResult } from "@/domain/storyboard";
import { zTimeline, type Timeline } from "@/domain/timeline";
import { ASPECT_DIMS, channelById } from "@/domain/delivery";
import { notFound, badRequest } from "./errors";
import { getProduct } from "./products";
import { getTalent } from "./talent";

export const zCampaignInput = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["image", "video"]),
  brief: zCampaignBrief.optional(),
  settings: zCampaignSettings.partial().optional(),
  productIds: z.array(z.string()).optional(),
  talent: z.array(z.object({ talentId: z.string(), outfitId: z.string().optional().nullable() })).optional(),
  refs: z.array(z.object({ assetId: z.string(), role: z.string().default("style"), note: z.string().optional() })).optional(),
});

function hydrate(db: DB, c: typeof campaigns.$inferSelect) {
  const prods = db.select({ productId: campaignProducts.productId, order: campaignProducts.order }).from(campaignProducts).where(eq(campaignProducts.campaignId, c.id)).orderBy(asc(campaignProducts.order)).all();
  const tal = db.select().from(campaignTalent).where(eq(campaignTalent.campaignId, c.id)).all();
  const refs = db.select({ assetId: campaignRefs.assetId, role: campaignRefs.role, note: campaignRefs.note, asset: assets }).from(campaignRefs).innerJoin(assets, eq(assets.id, campaignRefs.assetId)).where(eq(campaignRefs.campaignId, c.id)).all();
  const shotRows = db.select().from(shots).where(eq(shots.campaignId, c.id)).orderBy(asc(shots.order)).all();
  const shotStats = db
    .select({ shotId: candidates.shotId, stage: candidates.stage, n: sql<number>`count(*)`, approved: sql<number>`sum(case when review='approved' then 1 else 0 end)` })
    .from(candidates)
    .where(inArray(candidates.shotId, shotRows.map((s) => s.id).concat(["_none_"])))
    .groupBy(candidates.shotId, candidates.stage)
    .all();
  const spend = db.select({ s: sql<number>`coalesce(sum(coalesce(actual_usd, estimate_usd)),0)` }).from(generations).where(inArray(generations.shotId, shotRows.map((s) => s.id).concat(["_none_"]))).get()?.s ?? 0;
  return {
    ...c,
    brief: zCampaignBrief.parse(JSON.parse(c.briefJson || "{}")),
    settings: zCampaignSettings.parse(JSON.parse(c.settingsJson || "{}")),
    storyboard: c.storyboardJson ? (JSON.parse(c.storyboardJson) as Storyboard) : null,
    productIds: prods.map((p) => p.productId),
    talent: tal.map((t) => ({ talentId: t.talentId, outfitId: t.outfitId })),
    refs: refs.filter((r) => !r.asset.deletedAt),
    shots: shotRows.map((s) => ({
      ...s,
      spec: zShotSpec.parse(JSON.parse(s.specJson)),
      compiledPrompt: s.compiledPromptJson ? JSON.parse(s.compiledPromptJson) : null,
      stats: shotStats.filter((x) => x.shotId === s.id).map((x) => ({ stage: x.stage, candidates: x.n, approved: x.approved })),
    })),
    spendUsd: +spend.toFixed(2),
  };
}
export type CampaignView = ReturnType<typeof hydrate>;
export type ShotView = CampaignView["shots"][number];

export function listCampaigns(db: DB, projectId: string): CampaignView[] {
  return db.select().from(campaigns).where(eq(campaigns.projectId, projectId)).orderBy(desc(campaigns.updatedAt)).all().map((c) => hydrate(db, c));
}

export function getCampaign(db: DB, id: string): CampaignView {
  const c = db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  if (!c) throw notFound("Campaign");
  return hydrate(db, c);
}

export function createCampaign(db: DB, projectId: string, input: z.infer<typeof zCampaignInput>): CampaignView {
  const id = newId();
  const now = Date.now();
  const settings = zCampaignSettings.parse({ ...(input.settings ?? {}), default_aspect: input.settings?.default_aspect ?? (input.kind === "video" ? "9:16" : "4:5") });
  db.insert(campaigns).values({ id, projectId, name: input.name, kind: input.kind, briefJson: JSON.stringify(input.brief ?? zCampaignBrief.parse({})), settingsJson: JSON.stringify(settings), status: "draft", createdAt: now, updatedAt: now }).run();
  (input.productIds ?? []).forEach((pid, i) => db.insert(campaignProducts).values({ campaignId: id, productId: pid, order: i }).run());
  for (const t of input.talent ?? []) db.insert(campaignTalent).values({ campaignId: id, talentId: t.talentId, outfitId: t.outfitId ?? null }).run();
  for (const r of input.refs ?? []) db.insert(campaignRefs).values({ campaignId: id, assetId: r.assetId, role: r.role, note: r.note ?? null }).run();
  return getCampaign(db, id);
}

export function updateCampaign(db: DB, id: string, patch: Partial<z.infer<typeof zCampaignInput>> & { status?: string; storyboard?: Storyboard | null }): CampaignView {
  const cur = getCampaign(db, id);
  if (patch.storyboard !== undefined && patch.storyboard !== null) {
    zStoryboard.parse(patch.storyboard);
    saveRevision(db, "storyboard", id, patch.storyboard);
  }
  db.update(campaigns)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.brief ? { briefJson: JSON.stringify(zCampaignBrief.parse({ ...cur.brief, ...patch.brief })) } : {}),
      ...(patch.settings ? { settingsJson: JSON.stringify(zCampaignSettings.parse({ ...cur.settings, ...patch.settings })) } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.storyboard !== undefined ? { storyboardJson: patch.storyboard ? JSON.stringify(patch.storyboard) : null } : {}),
      updatedAt: Date.now(),
    })
    .where(eq(campaigns.id, id))
    .run();
  if (patch.productIds) {
    db.delete(campaignProducts).where(eq(campaignProducts.campaignId, id)).run();
    patch.productIds.forEach((pid, i) => db.insert(campaignProducts).values({ campaignId: id, productId: pid, order: i }).run());
  }
  if (patch.talent) {
    db.delete(campaignTalent).where(eq(campaignTalent.campaignId, id)).run();
    for (const t of patch.talent) db.insert(campaignTalent).values({ campaignId: id, talentId: t.talentId, outfitId: t.outfitId ?? null }).run();
  }
  if (patch.refs) {
    db.delete(campaignRefs).where(eq(campaignRefs.campaignId, id)).run();
    for (const r of patch.refs) db.insert(campaignRefs).values({ campaignId: id, assetId: r.assetId, role: r.role, note: r.note ?? null }).run();
  }
  return getCampaign(db, id);
}

export function saveRevision(db: DB, docType: string, docId: string, data: unknown): void {
  const last = db.select({ r: sql<number>`coalesce(max(revision),0)` }).from(docRevisions).where(and(eq(docRevisions.docType, docType), eq(docRevisions.docId, docId))).get()?.r ?? 0;
  db.insert(docRevisions).values({ id: newId(), docType, docId, revision: last + 1, dataJson: JSON.stringify(data), createdAt: Date.now() }).run();
  const old = db.select({ id: docRevisions.id }).from(docRevisions).where(and(eq(docRevisions.docType, docType), eq(docRevisions.docId, docId))).orderBy(desc(docRevisions.revision)).limit(1000).offset(50).all();
  if (old.length) db.delete(docRevisions).where(inArray(docRevisions.id, old.map((o) => o.id))).run();
}

export function listRevisions(db: DB, docType: string, docId: string) {
  return db.select({ id: docRevisions.id, revision: docRevisions.revision, createdAt: docRevisions.createdAt }).from(docRevisions).where(and(eq(docRevisions.docType, docType), eq(docRevisions.docId, docId))).orderBy(desc(docRevisions.revision)).all();
}

export function getRevision(db: DB, id: string): unknown {
  const r = db.select().from(docRevisions).where(eq(docRevisions.id, id)).get();
  if (!r) throw notFound("Revision");
  return JSON.parse(r.dataJson);
}

// ---------- shots ----------

export function createShot(db: DB, campaignId: string, title: string, spec: ShotSpec, order?: number): ShotView {
  const c = getCampaign(db, campaignId);
  const id = newId();
  const now = Date.now();
  db.insert(shots).values({ id, campaignId, order: order ?? c.shots.length, title, specJson: JSON.stringify(zShotSpec.parse(spec)), approved: 0, status: "planned", createdAt: now, updatedAt: now }).run();
  return getShot(db, id);
}

export function getShot(db: DB, id: string): ShotView {
  const s = db.select().from(shots).where(eq(shots.id, id)).get();
  if (!s) throw notFound("Shot");
  const c = getCampaign(db, s.campaignId);
  return c.shots.find((x) => x.id === id)!;
}

export function updateShot(db: DB, id: string, patch: { title?: string; spec?: Partial<ShotSpec>; approved?: boolean; order?: number; status?: string; selectedAssetId?: string | null; keyframeAssetId?: string | null; clipAssetId?: string | null; compiledPrompt?: unknown }): ShotView {
  const cur = getShot(db, id);
  const spec = patch.spec ? zShotSpec.parse({ ...cur.spec, ...patch.spec }) : undefined;
  db.update(shots)
    .set({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(spec ? { specJson: JSON.stringify(spec) } : {}),
      ...(patch.approved !== undefined ? { approved: patch.approved ? 1 : 0 } : {}),
      ...(patch.order !== undefined ? { order: patch.order } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.selectedAssetId !== undefined ? { selectedAssetId: patch.selectedAssetId } : {}),
      ...(patch.keyframeAssetId !== undefined ? { keyframeAssetId: patch.keyframeAssetId } : {}),
      ...(patch.clipAssetId !== undefined ? { clipAssetId: patch.clipAssetId } : {}),
      ...(patch.compiledPrompt !== undefined ? { compiledPromptJson: JSON.stringify(patch.compiledPrompt) } : {}),
      updatedAt: Date.now(),
    })
    .where(eq(shots.id, id))
    .run();
  return getShot(db, id);
}

export function reorderShots(db: DB, campaignId: string, orderedIds: string[]): CampaignView {
  orderedIds.forEach((id, i) => db.update(shots).set({ order: i, updatedAt: Date.now() }).where(and(eq(shots.id, id), eq(shots.campaignId, campaignId))).run());
  return getCampaign(db, campaignId);
}

export function deleteShot(db: DB, id: string): void {
  db.delete(shots).where(eq(shots.id, id)).run();
}

export function replaceShots(db: DB, campaignId: string, items: { title: string; spec: ShotSpec }[]): CampaignView {
  const existing = db.select({ id: shots.id }).from(shots).where(eq(shots.campaignId, campaignId)).all();
  const withCandidates = db.select({ shotId: candidates.shotId }).from(candidates).where(inArray(candidates.shotId, existing.map((e) => e.id).concat(["_none_"]))).all();
  const keep = new Set(withCandidates.map((w) => w.shotId));
  for (const e of existing) if (!keep.has(e.id)) db.delete(shots).where(eq(shots.id, e.id)).run();
  const start = keep.size;
  items.forEach((it, i) => createShot(db, campaignId, it.title, it.spec, start + i));
  return getCampaign(db, campaignId);
}

// ---------- candidates / review ----------

export interface CandidateFilter {
  campaignId: string;
  stage?: string;
  shotId?: string;
  review?: string[];
  verdict?: string[];
  minScore?: number;
  flag?: string;
  lane?: string;
  model?: string;
  sort?: "score" | "newest" | "oldest";
  limit?: number;
  offset?: number;
}

export function listCandidates(db: DB, f: CandidateFilter) {
  const shotIds = db.select({ id: shots.id }).from(shots).where(eq(shots.campaignId, f.campaignId)).all().map((s) => s.id);
  if (shotIds.length === 0) return { items: [], total: 0 };
  const conds = [inArray(candidates.shotId, shotIds)];
  if (f.stage) conds.push(eq(candidates.stage, f.stage));
  if (f.shotId) conds.push(eq(candidates.shotId, f.shotId));
  if (f.review?.length) conds.push(inArray(candidates.review, f.review));
  if (f.minScore !== undefined) conds.push(sql`${candidates.qaScore} >= ${f.minScore}`);
  if (f.verdict?.length) conds.push(sql`json_extract(${candidates.qaJson}, '$.verdict') in (${sql.join(f.verdict.map((v) => sql`${v}`), sql`, `)})`);
  if (f.flag) conds.push(sql`${candidates.qaJson} like ${'%"kind":"' + f.flag + '"%'}`);
  if (f.lane) conds.push(sql`${generations.lane} = ${f.lane}`);
  if (f.model) conds.push(sql`${generations.modelId} = ${f.model}`);
  const where = and(...conds);
  const order = f.sort === "score" ? desc(candidates.qaScore) : f.sort === "oldest" ? asc(candidates.createdAt) : desc(candidates.createdAt);
  const base = db.select({ c: candidates, g: generations, a: assets }).from(candidates).innerJoin(generations, eq(generations.id, candidates.generationId)).innerJoin(assets, eq(assets.id, candidates.assetId)).where(where);
  const total = db.select({ n: sql<number>`count(*)` }).from(candidates).innerJoin(generations, eq(generations.id, candidates.generationId)).where(where).get()?.n ?? 0;
  const items = base.orderBy(order, desc(candidates.createdAt)).limit(f.limit ?? 200).offset(f.offset ?? 0).all().map((r) => ({
    ...r.c,
    qa: r.c.qaJson ? safeParse(r.c.qaJson) : null,
    generation: { id: r.g.id, lane: r.g.lane, modelId: r.g.modelId, seed: r.g.seed, estimateUsd: r.g.estimateUsd, actualUsd: r.g.actualUsd, promptText: r.g.promptText, capability: r.g.capability, referenceAssetIds: JSON.parse(r.g.referenceAssetIdsJson) as string[] },
    asset: r.a,
  }));
  return { items, total };
}
export type CandidateView = ReturnType<typeof listCandidates>["items"][number];

function safeParse(s: string) {
  try {
    const j = JSON.parse(s);
    const p = zQAResult.safeParse(j);
    return p.success ? p.data : j;
  } catch {
    return null;
  }
}

export function getCandidate(db: DB, id: string): CandidateView {
  const c = db.select().from(candidates).where(eq(candidates.id, id)).get();
  if (!c) throw notFound("Candidate");
  const shot = db.select().from(shots).where(eq(shots.id, c.shotId ?? "")).get();
  const r = listCandidates(db, { campaignId: shot?.campaignId ?? "", shotId: c.shotId ?? undefined, limit: 500 });
  const found = r.items.find((x) => x.id === id);
  if (!found) throw notFound("Candidate");
  return found;
}

export function reviewCandidate(db: DB, id: string, review: "unreviewed" | "approved" | "rejected" | "flagged" | "maybe", note?: string): CandidateView {
  const cur = getCandidate(db, id);
  db.update(candidates).set({ review, reviewNote: note ?? cur.reviewNote, reviewedAt: Date.now() }).where(eq(candidates.id, id)).run();
  db.insert(reviewsLog).values({ id: newId(), candidateId: id, action: review, note: note ?? null, at: Date.now() }).run();
  if (review === "approved" && cur.shotId) {
    const col = cur.stage === "keyframes" ? "keyframeAssetId" : cur.stage === "clips" ? "clipAssetId" : "selectedAssetId";
    db.update(shots).set({ [col]: cur.assetId, status: "approved", updatedAt: Date.now() } as never).where(eq(shots.id, cur.shotId)).run();
  }
  return getCandidate(db, id);
}

export function selectCandidate(db: DB, id: string): CandidateView {
  return reviewCandidate(db, id, "approved");
}

// ---------- timelines ----------

export function getTimeline(db: DB, campaignId: string): (typeof timelines.$inferSelect & { timeline: Timeline }) | null {
  const t = db.select().from(timelines).where(eq(timelines.campaignId, campaignId)).orderBy(desc(timelines.updatedAt)).get();
  return t ? { ...t, timeline: zTimeline.parse(JSON.parse(t.timelineJson)) } : null;
}

export function putTimeline(db: DB, campaignId: string, tl: Timeline) {
  const parsed = zTimeline.parse(tl);
  const cur = getTimeline(db, campaignId);
  if (cur) {
    saveRevision(db, "timeline", cur.id, parsed);
    db.update(timelines).set({ timelineJson: JSON.stringify(parsed), updatedAt: Date.now() }).where(eq(timelines.id, cur.id)).run();
  } else {
    const id = newId();
    db.insert(timelines).values({ id, campaignId, name: "Main", timelineJson: JSON.stringify(parsed), status: "draft", createdAt: Date.now(), updatedAt: Date.now() }).run();
    saveRevision(db, "timeline", id, parsed);
  }
  return getTimeline(db, campaignId)!;
}

/** Build a default timeline from approved clips in storyboard order. */
export function defaultTimeline(db: DB, campaignId: string): Timeline {
  const c = getCampaign(db, campaignId);
  const aspect = c.storyboard?.aspect ?? "9:16";
  const [w, h] = ASPECT_DIMS[aspect] ?? [1080, 1920];
  const clips = c.shots
    .filter((s) => s.clipAssetId)
    .map((s) => {
      const t = s.spec.transition_in ?? "cut";
      const type = t === "dissolve" ? "dissolve" : t === "fade" ? "fade" : t === "light_flare" ? "fadeblack" : t === "whip" ? "wipeleft" : "cut";
      return {
        asset_id: s.clipAssetId!,
        in_s: 0,
        out_s: s.spec.duration_s,
        fit: "cover" as const,
        transition_in: type === "cut" ? undefined : { type: type as "fade" | "dissolve" | "wipeleft" | "fadeblack", duration_s: 0.5 },
        overlays: s.spec.text_overlay ? [{ kind: "text" as const, copy: s.spec.text_overlay.copy, font: "InstrumentSerif-Regular" as const, size_px: 64, color: "#F5F3EE", position: s.spec.text_overlay.position, in_s: s.spec.text_overlay.in_s, out_s: s.spec.text_overlay.out_s }] : [],
        speed: 1,
      };
    });
  const endCopy = c.storyboard?.end_card?.copy;
  return zTimeline.parse({ version: 1, output: { width: w, height: h, fps: 30, channel_id: channelById("ig_reels")?.id }, clips, end_card: endCopy ? { duration_s: c.storyboard?.end_card?.duration_s ?? 1.5, bg_color: "#0C0C0D", copy: endCopy, fade_in_s: 0.3 } : undefined, keep_clip_audio: false });
}

// ---------- exports ----------

export function createExport(db: DB, campaignId: string, channelId: string, sourceAssetId: string, params: Record<string, unknown> = {}) {
  if (!channelById(channelId)) throw badRequest(`Unknown channel ${channelId}`);
  const id = newId();
  db.insert(exportsTable).values({ id, campaignId, channelId, sourceAssetId, paramsJson: JSON.stringify(params), status: "queued", createdAt: Date.now() }).run();
  return db.select().from(exportsTable).where(eq(exportsTable.id, id)).get()!;
}

export function listExports(db: DB, campaignId: string) {
  return db.select().from(exportsTable).where(eq(exportsTable.campaignId, campaignId)).orderBy(desc(exportsTable.createdAt)).all();
}

/** Everything the generation handlers need about a shot, in one call. */
export function loadShotContext(db: DB, shotId: string) {
  const shot = getShot(db, shotId);
  const campaign = getCampaign(db, shot.campaignId);
  const productIds = shot.spec.product_ids.length ? shot.spec.product_ids : campaign.productIds.slice(0, 1);
  const prods = productIds.map((id) => getProduct(db, id));
  const talentId = shot.spec.talent_id ?? campaign.talent[0]?.talentId;
  const tal = talentId ? getTalent(db, talentId) : undefined;
  const outfitId = shot.spec.outfit_id ?? campaign.talent.find((t) => t.talentId === talentId)?.outfitId ?? undefined;
  const outfit = tal?.outfits.find((o) => o.id === outfitId);
  return { shot, campaign, products: prods, talent: tal, outfit };
}
