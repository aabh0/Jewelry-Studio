import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { talent, talentRefs, outfits, outfitRefs, assets } from "@/db/schema";
import { newId } from "@/lib/ids";
import { zTalentSpec, zOutfitSpec } from "@/domain/talent";
import { notFound } from "./errors";
import type { AssetRow } from "./assets";

export const zTalentInput = z.object({ name: z.string().min(1).max(80), spec: zTalentSpec, lockedFeatures: z.array(z.string()).optional() });
export const TALENT_REF_ROLES = ["front", "three_quarter", "profile", "full_body", "expression", "hands", "ears", "neck", "sheet", "upload"] as const;

function hydrate(db: DB, t: typeof talent.$inferSelect) {
  const refs = db.select({ assetId: talentRefs.assetId, role: talentRefs.role, approved: talentRefs.approved, order: talentRefs.order, asset: assets }).from(talentRefs).innerJoin(assets, eq(assets.id, talentRefs.assetId)).where(eq(talentRefs.talentId, t.id)).orderBy(asc(talentRefs.order)).all();
  const outs = db.select().from(outfits).where(eq(outfits.talentId, t.id)).orderBy(asc(outfits.createdAt)).all().map((o) => ({
    ...o,
    spec: zOutfitSpec.parse(JSON.parse(o.specJson)),
    refs: db.select({ asset: assets }).from(outfitRefs).innerJoin(assets, eq(assets.id, outfitRefs.assetId)).where(eq(outfitRefs.outfitId, o.id)).orderBy(asc(outfitRefs.order)).all().map((r) => r.asset),
  }));
  return { ...t, spec: zTalentSpec.parse(JSON.parse(t.specJson)), lockedFeatures: JSON.parse(t.lockedFeaturesJson) as string[], refs: refs.filter((r) => !r.asset.deletedAt), outfits: outs };
}
export type TalentView = ReturnType<typeof hydrate>;

export function listTalent(db: DB, projectId: string): TalentView[] {
  return db.select().from(talent).where(eq(talent.projectId, projectId)).orderBy(asc(talent.createdAt)).all().map((t) => hydrate(db, t));
}

export function getTalent(db: DB, id: string): TalentView {
  const t = db.select().from(talent).where(eq(talent.id, id)).get();
  if (!t) throw notFound("Talent");
  return hydrate(db, t);
}

export function createTalent(db: DB, projectId: string, input: z.infer<typeof zTalentInput>): TalentView {
  const id = newId();
  const now = Date.now();
  db.insert(talent).values({ id, projectId, name: input.name, specJson: JSON.stringify(input.spec), lockedFeaturesJson: JSON.stringify(input.lockedFeatures ?? ["face", "hair", "skin tone", "nails"]), createdAt: now, updatedAt: now }).run();
  return getTalent(db, id);
}

export function updateTalent(db: DB, id: string, patch: Partial<z.infer<typeof zTalentInput>> & { identityMode?: "reference_pack" | "soul_id"; soulId?: string | null; soulStatus?: string | null }): TalentView {
  getTalent(db, id);
  db.update(talent)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.spec ? { specJson: JSON.stringify(patch.spec) } : {}),
      ...(patch.lockedFeatures ? { lockedFeaturesJson: JSON.stringify(patch.lockedFeatures) } : {}),
      ...(patch.identityMode ? { identityMode: patch.identityMode } : {}),
      ...(patch.soulId !== undefined ? { soulId: patch.soulId } : {}),
      ...(patch.soulStatus !== undefined ? { soulStatus: patch.soulStatus } : {}),
      updatedAt: Date.now(),
    })
    .where(eq(talent.id, id))
    .run();
  return getTalent(db, id);
}

export function addTalentRef(db: DB, talentId: string, assetId: string, role: string): TalentView {
  const t = getTalent(db, talentId);
  db.insert(talentRefs).values({ talentId, assetId, role, approved: 1, order: t.refs.length }).onConflictDoUpdate({ target: [talentRefs.talentId, talentRefs.assetId], set: { role } }).run();
  return getTalent(db, talentId);
}

export function updateTalentRef(db: DB, talentId: string, assetId: string, patch: { role?: string; approved?: boolean }): TalentView {
  db.update(talentRefs).set({ ...(patch.role ? { role: patch.role } : {}), ...(patch.approved !== undefined ? { approved: patch.approved ? 1 : 0 } : {}) }).where(and(eq(talentRefs.talentId, talentId), eq(talentRefs.assetId, assetId))).run();
  return getTalent(db, talentId);
}

export function removeTalentRef(db: DB, talentId: string, assetId: string): TalentView {
  db.delete(talentRefs).where(and(eq(talentRefs.talentId, talentId), eq(talentRefs.assetId, assetId))).run();
  return getTalent(db, talentId);
}

export function createOutfit(db: DB, talentId: string, name: string, spec: z.infer<typeof zOutfitSpec>): TalentView {
  getTalent(db, talentId);
  db.insert(outfits).values({ id: newId(), talentId, name, specJson: JSON.stringify(spec), createdAt: Date.now() }).run();
  return getTalent(db, talentId);
}

export function updateOutfit(db: DB, outfitId: string, patch: { name?: string; spec?: z.infer<typeof zOutfitSpec> }): void {
  db.update(outfits).set({ ...(patch.name ? { name: patch.name } : {}), ...(patch.spec ? { specJson: JSON.stringify(patch.spec) } : {}) }).where(eq(outfits.id, outfitId)).run();
}

export function addOutfitRef(db: DB, outfitId: string, assetId: string): void {
  const n = db.select().from(outfitRefs).where(eq(outfitRefs.outfitId, outfitId)).all().length;
  db.insert(outfitRefs).values({ outfitId, assetId, order: n }).onConflictDoNothing().run();
}

export function deleteOutfit(db: DB, outfitId: string): void {
  db.delete(outfitRefs).where(eq(outfitRefs.outfitId, outfitId)).run();
  db.delete(outfits).where(eq(outfits.id, outfitId)).run();
}

/** Identity reference set: front → three_quarter → profile → crop-specific (hands/ears/neck). */
export function talentReferenceSet(t: TalentView, crop?: string, max = 4): { asset: AssetRow; role: "talent_identity" | "talent_hands" | "talent_ear" | "talent_neck" }[] {
  const approved = t.refs.filter((r) => r.approved === 1);
  const out: { asset: AssetRow; role: "talent_identity" | "talent_hands" | "talent_ear" | "talent_neck" }[] = [];
  for (const role of ["front", "three_quarter", "profile", "upload", "sheet", "full_body"]) {
    const r = approved.find((x) => x.role === role);
    if (r && !out.some((o) => o.asset.id === r.asset.id)) out.push({ asset: r.asset, role: "talent_identity" });
    if (out.length >= 2) break;
  }
  const cropRole = crop === "hand" || crop === "wrist" ? "hands" : crop === "ear" ? "ears" : crop === "neck" || crop === "decolletage" ? "neck" : null;
  if (cropRole) {
    const r = approved.find((x) => x.role === cropRole);
    if (r) out.push({ asset: r.asset, role: cropRole === "hands" ? "talent_hands" : cropRole === "ears" ? "talent_ear" : "talent_neck" });
  }
  return out.slice(0, max);
}

export function deleteTalent(db: DB, id: string): void {
  const t = getTalent(db, id);
  for (const o of t.outfits) deleteOutfit(db, o.id);
  db.delete(talentRefs).where(eq(talentRefs.talentId, id)).run();
  db.delete(talent).where(eq(talent.id, id)).run();
}
