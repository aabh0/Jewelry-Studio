"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Sparkles, Plus, GripVertical, MoreHorizontal, Copy, Trash2, Play, Eye, Pencil, ArrowRight, Wand2 } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch, Skeleton, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/empty";
import { Dialog, DialogContent, DialogFooter, Drawer } from "@/components/ui/dialog";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useGet, useAction, useAutosave } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/money";
import { CampaignHeader, type Campaign } from "@/components/studio/campaign-nav";
import { RunningJobs, EstimateBadge, CapabilityBadge, useCapabilities } from "@/components/studio/widgets";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { ShotEditor } from "@/components/studio/shot-editor";
import type { ProductLite, TalentLite } from "@/components/studio/project-cards";
import { humanize } from "@/domain/taxonomy";
import { zShotSpec, type ShotSpec } from "@/domain/storyboard";
import { lightingFromPreset } from "@/domain/lighting";
import { cn } from "@/lib/cn";

type Shot = Campaign["shots"][number];
type Stage = "stills" | "keyframes" | "clips";
interface Compiled { bundle: { prompt_text: string; negative_text: string; sections: Record<string, string>; references: { role: string; assetId: string }[]; warnings: string[] }; resolved: { impl: { id: string; label: string; lane: string; model: string; degraded?: string }; unavailable: boolean; reason?: string }; estimate: { unit_usd: number | null; total_usd: number | null; variants: number; note?: string } }

export default function ShotsPage() {
  const { id, campaignId } = useParams<{ id: string; campaignId: string }>();
  const router = useRouter();
  const q = useGet<Campaign>(`/api/campaigns/${campaignId}`);
  const products = useGet<{ items: ProductLite[] }>(`/api/projects/${id}/products`);
  const talent = useGet<{ items: TalentLite[] }>(`/api/projects/${id}/talent`);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [planOpen, setPlanOpen] = React.useState(false);
  const [genOpen, setGenOpen] = React.useState<Stage | null>(null);
  const [order, setOrder] = React.useState<string[] | null>(null);
  const c = q.data;
  const shots = React.useMemo(() => { const list = c?.shots ?? []; if (!order) return list; const byId = new Map(list.map((s) => [s.id, s])); return order.map((i) => byId.get(i)).filter((s): s is Shot => !!s).concat(list.filter((s) => !order.includes(s.id))); }, [c, order]);
  const isVideo = c?.kind === "video";
  const stage: Stage = !isVideo ? "stills" : c?.shots.some((s) => s.approved && s.keyframeAssetId) ? "clips" : "keyframes";
  const reorder = useAction((ids: string[]) => api.post(`/api/campaigns/${campaignId}/reorder`, { orderedIds: ids }), { invalidate: ["/api/campaigns"] });
  const patchShot = useAction((a: { id: string; patch: Record<string, unknown> }) => api.patch(`/api/shots/${a.id}`, a.patch), { invalidate: ["/api/campaigns"] });
  const addShot = useAction(() => api.post<Shot>(`/api/campaigns/${campaignId}/shots`, { title: `Shot ${(c?.shots.length ?? 0) + 1}`, spec: zShotSpec.parse({ product_ids: c?.productIds.slice(0, 1) ?? [], aspect: c?.settings.default_aspect, variants: c?.settings.variants_per_shot, lighting: lightingFromPreset(c?.settings.lighting_preset ?? "clean_studio"), talent_id: c?.talent[0]?.talentId, duration_s: isVideo ? 4 : undefined }) }), { invalidate: ["/api/campaigns"], onSuccess: (s) => setEditing(s.id) });
  const dupShot = useAction((s: Shot) => api.post<Shot>(`/api/campaigns/${campaignId}/shots`, { title: `${s.title} (copy)`, spec: s.spec }), { invalidate: ["/api/campaigns"] });
  const delShot = useAction((sid: string) => api.del(`/api/shots/${sid}`), { invalidate: ["/api/campaigns"] });
  const genOne = useAction((a: { id: string; stage?: Stage; variants?: number }) => api.post(`/api/shots/${a.id}/generate`, a), { invalidate: ["/api/jobs", "/api/campaigns"], success: "Generation queued" });
  const approveAll = useAction(async (v: boolean) => { for (const s of c?.shots ?? []) if (!!s.approved !== v) await api.patch(`/api/shots/${s.id}`, { approved: v }); }, { invalidate: ["/api/campaigns"] });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => { const { active, over } = e; if (!over || active.id === over.id) return; const ids = shots.map((s) => s.id); const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))); setOrder(next); reorder.mutate(next, { onSettled: () => setOrder(null) }); };
  if (!c) return <div className="mx-auto max-w-[1200px] px-8 py-8"><Skeleton className="h-12 w-96" /><Skeleton className="mt-6 h-[480px]" /></div>;
  const approved = c.shots.filter((s) => s.approved);
  const genTargets = stage === "clips" ? approved.filter((s) => s.keyframeAssetId) : approved;
  const stageLabel = stage === "stills" ? "stills" : stage === "keyframes" ? "keyframes" : "clips";
  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8 space-y-6">
      <CampaignHeader c={c} right={<>
        <Button variant="ghost" onClick={() => setPlanOpen(true)} disabled={c.productIds.length === 0}><Sparkles /> {c.shots.length ? "Re-plan with director" : "Plan with director"}</Button>
        <Button variant="ghost" onClick={() => addShot.mutate()}><Plus /> Shot</Button>
        <Button variant="primary" disabled={genTargets.length === 0} onClick={() => setGenOpen(stage)}><Play /> Generate {stageLabel} ({genTargets.length})</Button>
      </>} />
      <RunningJobs projectId={id} campaignId={campaignId} />
      {isVideo && !c.storyboard ? <div className="rounded-[var(--radius-md)] bg-bg-1 hairline p-4 flex items-center justify-between"><div className="text-[13px] text-fg-1">Video campaigns start from a storyboard. Write one first, then approve its frames here.</div><Button size="sm" variant="primary" onClick={() => router.push(`/projects/${id}/campaigns/${campaignId}/storyboard`)}>Storyboard <ArrowRight /></Button></div> : null}
      {c.shots.length === 0 ? (
        <EmptyState title={isVideo ? "No keyframes yet" : "No shots yet"} body={isVideo ? "The storyboard creates one keyframe per frame." : "Let the director propose a shot list from the brief and the products, or add shots by hand."} action={<div className="flex gap-2">{!isVideo ? <Button variant="primary" disabled={c.productIds.length === 0} onClick={() => setPlanOpen(true)}><Sparkles /> Plan with director</Button> : null}<Button variant="ghost" onClick={() => addShot.mutate()}><Plus /> Add a shot</Button></div>} />
      ) : (
        <>
          <div className="flex items-center gap-2 text-[12px] text-fg-2">
            <span className="tabular">{approved.length}/{c.shots.length} approved</span>
            <span className="text-fg-3">·</span>
            <button className="hover:text-fg-0 cursor-pointer" onClick={() => approveAll.mutate(true)}>Approve all</button>
            <span className="text-fg-3">·</span>
            <button className="hover:text-fg-0 cursor-pointer" onClick={() => approveAll.mutate(false)}>Clear</button>
            <span className="ml-auto">Drag to reorder · approved shots are generated in this order</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
            <SortableContext items={shots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">{shots.map((s, i) => <ShotRow key={s.id} s={s} index={i} isVideo={isVideo} products={products.data?.items ?? []} onEdit={() => setEditing(s.id)} onApprove={(v) => patchShot.mutate({ id: s.id, patch: { approved: v } })} onGenerate={() => genOne.mutate({ id: s.id })} onDuplicate={() => dupShot.mutate(s)} onDelete={() => { if (confirm(`Delete “${s.title}”?`)) delShot.mutate(s.id); }} onReview={() => router.push(`/projects/${id}/campaigns/${campaignId}/review?shot=${s.id}`)} />)}</div>
            </SortableContext>
          </DndContext>
        </>
      )}
      <PlanDialog open={planOpen} onOpenChange={setPlanOpen} campaignId={campaignId} defaultCount={c.brief.deliverables.stills ?? 6} hasShots={c.shots.length > 0} />
      <GenerateDialog stage={genOpen} onOpenChange={(o) => { if (!o) setGenOpen(null); }} campaignId={campaignId} shots={genTargets} />
      <ShotDrawer shot={shots.find((s) => s.id === editing) ?? null} onOpenChange={(o) => { if (!o) setEditing(null); }} isVideo={isVideo} products={products.data?.items ?? []} talent={talent.data?.items ?? []} />
    </div>
  );
}

function ShotRow({ s, index, isVideo, products, onEdit, onApprove, onGenerate, onDuplicate, onDelete, onReview }: { s: Shot; index: number; isVideo: boolean; products: ProductLite[]; onEdit: () => void; onApprove: (v: boolean) => void; onGenerate: () => void; onDuplicate: () => void; onDelete: () => void; onReview: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const picked = isVideo ? (s.clipAssetId ?? s.keyframeAssetId) : s.selectedAssetId;
  const candidates = s.stats.reduce((n, x) => n + x.candidates, 0);
  const approvedC = s.stats.reduce((n, x) => n + x.approved, 0);
  const prodNames = s.spec.product_ids.map((pid) => products.find((p) => p.id === pid)?.name ?? "?").join(", ");
  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-center gap-3 rounded-[var(--radius-md)] bg-bg-1 hairline p-2 pr-3", isDragging && "shadow-float opacity-90 z-10 relative", !s.approved && "opacity-80")}>
      <button className="cursor-grab text-fg-3 hover:text-fg-1 px-1 touch-none" aria-label="Drag" {...attributes} {...listeners}><GripVertical className="size-4" /></button>
      <span className="w-5 text-[11px] text-fg-3 tabular">{index + 1}</span>
      <AssetThumb asset={picked ? { id: picked, kind: isVideo && s.clipAssetId ? "video" : "image" } : null} aspect={1} className="size-14 shrink-0" onClick={onEdit}>{!picked ? <div className="absolute inset-0 flex items-center justify-center text-[10px] text-fg-3">{humanize(s.spec.format).split(" ")[0]}</div> : null}</AssetThumb>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-2"><span className="text-[14px] font-medium truncate">{s.title}</span>{s.spec.priority === 1 ? <Badge tone="accent">must</Badge> : null}<Badge>{humanize(s.spec.format)}</Badge>{isVideo && s.spec.duration_s ? <Badge>{s.spec.duration_s}s · {humanize(s.spec.camera_move ?? "static")}</Badge> : null}</div>
        <div className="mt-0.5 text-[12px] text-fg-2 truncate">{s.spec.purpose || "No purpose yet"}{prodNames ? ` · ${prodNames}` : ""}</div>
        <div className="mt-0.5 text-[11px] text-fg-3">{s.spec.aspect} · {s.spec.variants} variants · {humanize(s.spec.lighting.mood)} · {s.spec.camera.lens_mm}mm {s.spec.camera.aperture}{s.spec.talent_id ? " · with person" : ""}</div>
      </div>
      {candidates ? <button className="text-[12px] text-fg-1 hover:text-fg-0 tabular cursor-pointer" onClick={onReview}>{approvedC}/{candidates} approved</button> : null}
      <Badge tone={s.status === "approved" ? "ok" : s.status === "generating" ? "info" : "neutral"}>{s.status}</Badge>
      <Tooltip content={s.approved ? "Approved for generation" : "Approve for generation"}><span><Switch checked={!!s.approved} onCheckedChange={onApprove} /></span></Tooltip>
      <Menu>
        <MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="More"><MoreHorizontal /></Button></MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onEdit}><Pencil /> Edit shot</MenuItem>
          <MenuItem onSelect={onGenerate}><Play /> Generate this shot</MenuItem>
          {candidates ? <MenuItem onSelect={onReview}><Eye /> Review candidates</MenuItem> : null}
          <MenuItem onSelect={onDuplicate}><Copy /> Duplicate</MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={onDelete}><Trash2 /> Delete</MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

function PlanDialog({ open, onOpenChange, campaignId, defaultCount, hasShots }: { open: boolean; onOpenChange: (o: boolean) => void; campaignId: string; defaultCount: number; hasShots: boolean }) {
  const [count, setCount] = React.useState(defaultCount);
  const plan = useAction(() => api.post(`/api/campaigns/${campaignId}/plan`, { count }), { invalidate: ["/api/jobs", "/api/campaigns"], success: "Director is planning the shots", onSuccess: () => onOpenChange(false) });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Plan with the director" description={hasShots ? "Shots without candidates are replaced. Shots that already have generations are kept." : "The director reads the brief, products, person and references, then proposes a shot list you can edit."}>
        <Field label="How many shots"><Input type="number" min={1} max={24} value={count} onChange={(e) => setCount(Math.min(24, Math.max(1, Number(e.target.value) || 1)))} /></Field>
        <div className="mt-3 flex items-center gap-2 text-[12px] text-fg-2"><CapabilityBadge id="director" /> Claude, a few cents per plan.</div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={plan.isPending} onClick={() => plan.mutate()}><Sparkles /> Plan {count} shots</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateDialog({ stage, onOpenChange, campaignId, shots }: { stage: Stage | null; onOpenChange: (o: boolean) => void; campaignId: string; shots: Shot[] }) {
  const [estimates, setEstimates] = React.useState<Record<string, Compiled["estimate"] & { impl?: string }>>({});
  const [variants, setVariants] = React.useState<string>("");
  React.useEffect(() => {
    if (!stage) return;
    let alive = true;
    setEstimates({});
    Promise.all(shots.map((s) => api.post<Compiled>(`/api/shots/${s.id}/compile`).then((r) => [s.id, { ...r.estimate, impl: r.resolved.impl.label }] as const).catch(() => [s.id, { unit_usd: null, total_usd: null, variants: s.spec.variants, note: "estimate failed" }] as const))).then((rows) => { if (alive) setEstimates(Object.fromEntries(rows)); });
    return () => { alive = false; };
  }, [stage, shots]);
  const run = useAction(() => api.post<{ count: number }>(`/api/campaigns/${campaignId}/generate`, { stage, variants: variants ? Number(variants) : undefined }), { invalidate: ["/api/jobs", "/api/campaigns"], success: (r) => `Generating ${r.count} shots`, onSuccess: () => onOpenChange(false) });
  const total = Object.values(estimates).reduce((n, e) => n + (e.total_usd ?? 0), 0);
  const unknown = Object.values(estimates).some((e) => e.total_usd === null);
  const ready = Object.keys(estimates).length === shots.length;
  const caps = useCapabilities();
  const lane = caps.data?.lanes;
  return (
    <Dialog open={!!stage} onOpenChange={onOpenChange}>
      <DialogContent title={`Generate ${stage}`} description={stage === "clips" ? "One clip batch per approved keyframe. Video is the expensive step; check the estimate." : "One batch per approved shot. Each batch is one paid job; identical resubmits are blocked."}>
        <div className="max-h-[40vh] overflow-y-auto space-y-1 rounded-[var(--radius-md)] bg-bg-2 p-2">
          {shots.map((s) => { const e = estimates[s.id]; return <div key={s.id} className="flex items-center gap-2 text-[12px] px-2 py-1.5"><span className="truncate flex-1 text-fg-0">{s.title}</span><span className="text-fg-3">{e?.impl ?? "…"}</span><span className="text-fg-2 tabular">{e ? `${e.variants}×` : ""}</span>{e ? <EstimateBadge usd={e.total_usd} note={e.note} /> : <span className="skeleton h-4 w-12 rounded-full" />}</div>; })}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <Field label="Variants per shot (override)"><Select value={variants} onChange={(e) => setVariants(e.target.value)}><option value="">As set per shot</option>{[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
          <div className="ml-auto text-right"><div className="text-[11px] uppercase tracking-wide text-fg-2">Estimated total</div><div className="font-display text-[28px] leading-none tabular">{!ready ? "…" : unknown && total === 0 ? "CLI credits" : unknown ? `≈ ${formatUsd(total)} + credits` : formatUsd(total)}</div>{unknown ? <div className="text-[11px] text-fg-3">{total === 0 ? "Billed to your Higgsfield plan; credits are estimated when each batch runs." : "Some batches bill in CLI credits."}</div> : null}</div>
        </div>
        {lane && !lane.cloud.available && !lane.cli.available && !caps.data?.lanes.claude ? <Badge tone="danger" className="mt-3">No generation lane is configured. Add keys in Settings.</Badge> : null}
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={run.isPending || shots.length === 0} onClick={() => run.mutate()}><Play /> Generate {shots.length} {stage}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShotDrawer({ shot, onOpenChange, isVideo, products, talent }: { shot: Shot | null; onOpenChange: (o: boolean) => void; isVideo: boolean; products: ProductLite[]; talent: TalentLite[] }) {
  const [v, setV] = React.useState<{ title: string; spec: ShotSpec } | null>(null);
  const [tab, setTab] = React.useState("edit");
  const [compiled, setCompiled] = React.useState<Compiled | null>(null);
  const shotId = shot?.id ?? null;
  React.useEffect(() => { if (shot) { setV({ title: shot.title, spec: shot.spec }); setTab("edit"); setCompiled(null); } }, [shotId]); // eslint-disable-line react-hooks/exhaustive-deps
  const { save, flush } = useAutosave<{ title: string; spec: ShotSpec }>((patch) => (shotId ? api.patch(`/api/shots/${shotId}`, patch).then(() => undefined) : Promise.resolve()));
  const onChange = (nv: { title: string; spec: ShotSpec }) => { const patch: Partial<typeof nv> = {}; if (nv.title !== v?.title) patch.title = nv.title; if (JSON.stringify(nv.spec) !== JSON.stringify(v?.spec)) patch.spec = nv.spec; setV(nv); if (Object.keys(patch).length) save(patch); };
  const compile = useAction(async () => { await flush(); return api.post<Compiled>(`/api/shots/${shotId}/compile`); }, { onSuccess: (r) => setCompiled(r) });
  const gen = useAction((a: { variants?: number; impl_id?: string }) => api.post(`/api/shots/${shotId}/generate`, a), { invalidate: ["/api/jobs", "/api/campaigns"], success: "Generation queued", onSuccess: () => onOpenChange(false) });
  const approve = useAction((approved: boolean) => api.patch(`/api/shots/${shotId}`, { approved }), { invalidate: ["/api/campaigns"] });
  React.useEffect(() => { if (tab === "prompt" && shotId && !compiled && !compile.isPending) compile.mutate(); }, [tab, shotId, compiled, compile]);
  const caps = useCapabilities();
  const capId = v?.spec.talent_id ? "image.generate.person" : "image.generate.product";
  const capInfo = caps.data?.capabilities.find((x) => x.id === capId);
  const [impl, setImpl] = React.useState("");
  return (
    <D.Root open={!!shot} onOpenChange={onOpenChange}>
      <Drawer title={v?.title ?? "Shot"} width={640}>
        {!v || !shot ? null : (
          <div className="flex flex-col h-full">
            <Tabs value={tab} onValueChange={setTab} className="px-5 pt-4">
              <TabsList><TabsTrigger value="edit">Edit</TabsTrigger><TabsTrigger value="prompt">Prompt &amp; estimate</TabsTrigger></TabsList>
              <TabsContent value="edit" className="pt-4 pb-6"><ShotEditor title={v.title} spec={v.spec} onChange={onChange} products={products} talent={talent} isVideo={isVideo} /></TabsContent>
              <TabsContent value="prompt" className="pt-4 pb-6 space-y-4">
                {!compiled ? <div className="space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-32" /></div> : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-[12px]"><Badge tone={compiled.resolved.impl.degraded ? "warn" : "neutral"}>{compiled.resolved.impl.label}</Badge><span className="text-fg-2">{compiled.resolved.impl.lane} lane</span><EstimateBadge usd={compiled.estimate.total_usd} note={compiled.estimate.note} /><span className="text-fg-3">{compiled.estimate.variants} variants</span><Button size="sm" variant="ghost" className="ml-auto" onClick={() => compile.mutate()}><Wand2 /> Recompile</Button></div>
                    {compiled.bundle.warnings.map((w) => <Badge key={w} tone="warn">{w}</Badge>)}
                    <div className="space-y-2">{Object.entries(compiled.bundle.sections).map(([k, val]) => <div key={k} className="rounded-[var(--radius-sm)] bg-bg-2 p-3"><div className="text-[10px] uppercase tracking-wide text-fg-3">{k}</div><div className="mt-1 text-[12.5px] leading-relaxed text-fg-0 whitespace-pre-wrap">{val}</div></div>)}</div>
                    <div className="text-[11px] text-fg-3">References: {compiled.bundle.references.map((r) => r.role).join(", ") || "none"} · {compiled.bundle.prompt_text.length} chars</div>
                  </>
                )}
              </TabsContent>
            </Tabs>
            <div className="mt-auto border-t border-line px-5 py-3 flex items-center gap-2">
              <div className="flex items-center gap-2 text-[12px] text-fg-1"><Switch checked={!!shot.approved} onCheckedChange={(x) => approve.mutate(x)} /> Approved</div>
              <div className="flex-1" />
              <Select value={impl} onChange={(e) => setImpl(e.target.value)} className="h-8 w-[220px] text-[12px]"><option value="">Auto · {capInfo?.resolved.impl.label ?? "…"}</option>{(capInfo?.resolved.alternates ?? []).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select>
              <Button variant="primary" size="sm" disabled={gen.isPending} onClick={async () => { await flush(); gen.mutate({ impl_id: impl || undefined }); }}><Play /> Generate</Button>
            </div>
          </div>
        )}
      </Drawer>
    </D.Root>
  );
}

