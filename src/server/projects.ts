import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { projects, products, talent, campaigns, assets, ledger, jobs } from "@/db/schema";
import { newId } from "@/lib/ids";
import { notFound } from "./errors";

export const zProjectInput = z.object({
  name: z.string().min(1).max(120),
  clientName: z.string().max(120).optional().nullable(),
  brandNotes: z.string().max(8000).optional().nullable(),
  palette: z.array(z.string()).max(12).optional(),
  defaultChannels: z.array(z.string()).optional(),
  coverAssetId: z.string().optional().nullable(),
});
export type ProjectInput = z.infer<typeof zProjectInput>;

export function listProjects(db: DB, includeArchived = false) {
  const rows = db.select().from(projects).where(includeArchived ? undefined : eq(projects.archived, 0)).orderBy(desc(projects.lastOpenedAt), desc(projects.updatedAt)).all();
  return rows.map((p) => withCounts(db, p));
}

function withCounts(db: DB, p: typeof projects.$inferSelect) {
  const productCount = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.projectId, p.id)).get()?.n ?? 0;
  const campaignCount = db.select({ n: sql<number>`count(*)` }).from(campaigns).where(and(eq(campaigns.projectId, p.id), sql`${campaigns.status} != 'archived'`)).get()?.n ?? 0;
  const talentCount = db.select({ n: sql<number>`count(*)` }).from(talent).where(eq(talent.projectId, p.id)).get()?.n ?? 0;
  const spend = db.select({ s: sql<number>`coalesce(sum(coalesce(actual_usd, estimate_usd)),0)` }).from(ledger).where(eq(ledger.projectId, p.id)).get()?.s ?? 0;
  const running = db.select({ n: sql<number>`count(*)` }).from(jobs).where(and(eq(jobs.projectId, p.id), inArray(jobs.status, ["queued", "running"]))).get()?.n ?? 0;
  let cover = p.coverAssetId;
  if (!cover) {
    const latest = db.select({ id: assets.id }).from(assets).where(and(eq(assets.projectId, p.id), inArray(assets.role, ["candidate", "edit", "sheet", "plate", "upload"]), sql`${assets.kind} = 'image'`)).orderBy(desc(assets.createdAt)).limit(1).get();
    cover = latest?.id ?? null;
  }
  return { ...p, palette: p.paletteJson ? (JSON.parse(p.paletteJson) as string[]) : [], defaultChannels: JSON.parse(p.defaultChannelsJson) as string[], productCount, campaignCount, talentCount, spendUsd: +spend.toFixed(2), runningJobs: running, coverAssetId: cover };
}

export function getProject(db: DB, id: string) {
  const p = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!p) throw notFound("Project");
  return withCounts(db, p);
}

export function createProject(db: DB, input: ProjectInput) {
  const id = newId();
  const now = Date.now();
  db.insert(projects).values({ id, name: input.name, clientName: input.clientName ?? null, brandNotes: input.brandNotes ?? null, paletteJson: JSON.stringify(input.palette ?? []), defaultChannelsJson: JSON.stringify(input.defaultChannels ?? ["ig_feed_45", "ig_reels"]), coverAssetId: input.coverAssetId ?? null, createdAt: now, updatedAt: now, lastOpenedAt: now }).run();
  return getProject(db, id);
}

export function updateProject(db: DB, id: string, patch: Partial<ProjectInput> & { archived?: boolean }) {
  getProject(db, id);
  db.update(projects)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.clientName !== undefined ? { clientName: patch.clientName } : {}),
      ...(patch.brandNotes !== undefined ? { brandNotes: patch.brandNotes } : {}),
      ...(patch.palette !== undefined ? { paletteJson: JSON.stringify(patch.palette) } : {}),
      ...(patch.defaultChannels !== undefined ? { defaultChannelsJson: JSON.stringify(patch.defaultChannels) } : {}),
      ...(patch.coverAssetId !== undefined ? { coverAssetId: patch.coverAssetId } : {}),
      ...(patch.archived !== undefined ? { archived: patch.archived ? 1 : 0 } : {}),
      updatedAt: Date.now(),
    })
    .where(eq(projects.id, id))
    .run();
  return getProject(db, id);
}

export function touchProject(db: DB, id: string): void {
  db.update(projects).set({ lastOpenedAt: Date.now() }).where(eq(projects.id, id)).run();
}

export function duplicateProject(db: DB, id: string) {
  const src = getProject(db, id);
  const copy = createProject(db, { name: `${src.name} (copy)`, clientName: src.clientName, brandNotes: src.brandNotes, palette: src.palette, defaultChannels: src.defaultChannels });
  const prods = db.select().from(products).where(eq(products.projectId, id)).all();
  for (const p of prods) db.insert(products).values({ ...p, id: newId(), projectId: copy.id, createdAt: Date.now(), updatedAt: Date.now() }).run();
  const tal = db.select().from(talent).where(eq(talent.projectId, id)).all();
  for (const t of tal) db.insert(talent).values({ ...t, id: newId(), projectId: copy.id, createdAt: Date.now(), updatedAt: Date.now() }).run();
  return getProject(db, copy.id);
}
