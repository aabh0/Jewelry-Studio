"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog as D } from "radix-ui";
import { Clapperboard, Play, History, GripVertical, Pencil, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch, Skeleton, Progress } from "@/components/ui/controls";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { Drawer } from "@/components/ui/dialog";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel } from "@/components/ui/menu";
import { useGet, useAction, useAutosave } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { CampaignHeader, type Campaign } from "@/components/studio/campaign-nav";
import { RunningJobs, CapabilityBadge } from "@/components/studio/widgets";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { LightingEditor } from "@/components/studio/lighting-editor";
import { humanize } from "@/domain/taxonomy";
import { CAMERA_MOVES, VIDEO_STRUCTURES, type Storyboard, type StoryboardShot } from "@/domain/storyboard";
import { LENSES, APERTURES, SHOT_SIZES, ANGLES } from "@/domain/lighting";
import type { ProductLite, TalentLite } from "@/components/studio/project-cards";
import { cn } from "@/lib/cn";

export default function StoryboardPage() {
  const { id, campaignId } = useParams<{ id: string; campaignId: string }>();
  const router = useRouter();
  const q = useGet<Campaign>(`/api/campaigns/${campaignId}`);
  const products = useGet<{ items: ProductLite[] }>(`/api/projects/${id}/products`);
  const talent = useGet<{ items: TalentLite[] }>(`/api/projects/${id}/talent`);
  const revisions = useGet<{ items: { id: string; revision: number; createdAt: number }[] }>(`/api/revisions/storyboard/${campaignId}`);
  const [sb, setSb] = React.useState<Storyboard | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const c = q.data;
  const serverSb = c?.storyboard ?? null;
  const serverKey = serverSb ? JSON.stringify(serverSb.shots.map((s) => s.id)) + serverSb.title : "";
  React.useEffect(() => { if (serverSb) setSb(serverSb); }, [serverKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { save, flush } = useAutosave<{ storyboard: Storyboard }>((patch) => api.patch(`/api/campaigns/${campaignId}`, patch).then(() => undefined));
  const update = (next: Storyboard) => { setSb(next); save({ storyboard: next }); };
  const write = useAction(() => api.post(`/api/campaigns/${campaignId}/storyboard`), { invalidate: ["/api/jobs", "/api/campaigns"], success: "Director is writing the storyboard" });
  const reorder = useAction((ids: string[]) => api.post(`/api/campaigns/${campaignId}/reorder`, { orderedIds: ids }), { invalidate: ["/api/campaigns"] });
  const patchShot = useAction((a: { id: string; patch: Record<string, unknown> }) => api.patch(`/api/shots/${a.id}`, a.patch), { invalidate: ["/api/campaigns"] });
  const restore = useAction(async (revId: string) => { const r = await api.get<{ data: Storyboard }>(`/api/revisions/item/${revId}`); await api.patch(`/api/campaigns/${campaignId}`, { storyboard: r.data }); return r.data; }, { invalidate: ["/api/campaigns", "/api/revisions"], success: "Revision restored", onSuccess: (d) => setSb(d) });
  const approveAndGenerate = useAction(async () => { await flush(); for (const s of c?.shots ?? []) if (!s.approved) await api.patch(`/api/shots/${s.id}`, { approved: true }); return api.post<{ count: number }>(`/api/campaigns/${campaignId}/generate`, { stage: "keyframes" }); }, { invalidate: ["/api/jobs", "/api/campaigns"], success: (r) => `Generating ${r.count} keyframes`, onSuccess: () => router.push(`/projects/${id}/campaigns/${campaignId}/review?stage=keyframes`) });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  if (!c) return <div className="mx-auto max-w-[1300px] px-8 py-8"><Skeleton className="h-12 w-96" /><Skeleton className="mt-6 h-[480px]" /></div>;
  const shotById = new Map(c.shots.map((s) => [s.id, s]));
  const onDragEnd = (e: DragEndEvent) => { if (!sb) return; const { active, over } = e; if (!over || active.id === over.id) return; const ids = sb.shots.map((s) => s.id); const next = arrayMove(sb.shots, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))).map((s, i) => ({ ...s, order: i })); update({ ...sb, shots: next }); reorder.mutate(next.map((s) => s.id).filter((x) => shotById.has(x))); };
  const total = sb ? sb.shots.reduce((n, s) => n + s.duration_s, 0) + (sb.end_card?.duration_s ?? 0) : 0;
  const target = c.brief.deliverables.videos?.[0]?.duration_s ?? sb?.duration_s ?? 10;
  const approvedCount = c.shots.filter((s) => s.approved).length;
  return (
    <div className="mx-auto max-w-[1300px] px-8 py-8 space-y-6">
      <CampaignHeader c={c} right={<>
        <Menu>
          <MenuTrigger asChild><Button variant="ghost" disabled={!revisions.data?.items.length}><History /> Revisions</Button></MenuTrigger>
          <MenuContent><MenuLabel>Restore a version</MenuLabel>{(revisions.data?.items ?? []).slice(0, 12).map((r) => <MenuItem key={r.id} onSelect={() => restore.mutate(r.id)}>v{r.revision} · {new Date(r.createdAt).toLocaleString()}</MenuItem>)}</MenuContent>
        </Menu>
        <Button variant="ghost" disabled={write.isPending || c.productIds.length === 0} onClick={() => { if (!sb || confirm("Rewrite the storyboard? Frames without generations are replaced; the current version is kept in revisions.")) write.mutate(); }}><Clapperboard /> {sb ? "Rewrite" : "Write storyboard"}</Button>
        <Button variant="primary" disabled={!sb || approveAndGenerate.isPending} onClick={() => approveAndGenerate.mutate()}><Play /> Approve all &amp; generate keyframes</Button>
      </>} />
      <RunningJobs projectId={id} campaignId={campaignId} />
      {!sb ? (
        <EmptyState title="No storyboard yet" body={c.productIds.length === 0 ? "Add a product to the campaign first." : `The director writes a ${target}-second storyboard from your brief: structure, shots, camera moves, lighting and an end card. Every frame becomes a keyframe you approve before anything is generated.`} action={<div className="flex items-center gap-3"><Button variant="primary" disabled={write.isPending || c.productIds.length === 0} onClick={() => write.mutate()}><Clapperboard /> Write storyboard</Button><CapabilityBadge id="director" /></div>} />
      ) : (
        <>
          <section className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Field label="Title" className="md:col-span-2"><Input value={sb.title} onChange={(e) => update({ ...sb, title: e.target.value })} /></Field>
              <Field label="Structure"><Select value={sb.structure} onChange={(e) => update({ ...sb, structure: e.target.value as Storyboard["structure"] })}>{VIDEO_STRUCTURES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select></Field>
              <Field label="Aspect"><Select value={sb.aspect} onChange={(e) => update({ ...sb, aspect: e.target.value as Storyboard["aspect"] })}>{["9:16", "1:1", "16:9", "4:5"].map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
              <Field label="Music mood"><Input value={sb.music.mood} onChange={(e) => update({ ...sb, music: { ...sb.music, mood: e.target.value } })} /></Field>
              <Field label="Music"><Select value={sb.music.source} onChange={(e) => update({ ...sb, music: { ...sb.music, source: e.target.value as "none" } })}><option value="owner_upload">Your track (add in Assemble)</option><option value="none">No music</option></Select></Field>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
              <Field label="End card copy" className="md:col-span-3"><Input value={sb.end_card.copy ?? ""} onChange={(e) => update({ ...sb, end_card: { ...sb.end_card, copy: e.target.value || undefined } })} placeholder="Brand name · tagline" /></Field>
              <Field label="End card (s)"><Input type="number" step={0.5} min={0} value={sb.end_card.duration_s} onChange={(e) => update({ ...sb, end_card: { ...sb.end_card, duration_s: Number(e.target.value) || 0 } })} /></Field>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between text-[12px]"><span className="text-fg-2">Running time</span><span className={cn("tabular", Math.abs(total - target) > 1.5 ? "text-warn" : "text-fg-0")}>{total.toFixed(1)} s of {target} s</span></div>
                <Progress value={Math.min(100, (total / target) * 100)} tone={Math.abs(total - target) > 1.5 ? "danger" : "accent"} className="mt-1.5" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle right={<span className="text-[12px] text-fg-2 tabular">{approvedCount}/{sb.shots.length} frames approved · drag to reorder</span>}>Frames</SectionTitle>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sb.shots.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
                <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
                  {sb.shots.map((f, i) => { const shot = shotById.get(f.id); return <FrameCard key={f.id} f={f} index={i} aspect={sb.aspect} keyframeId={shot?.keyframeAssetId ?? null} clipId={shot?.clipAssetId ?? null} approved={!!shot?.approved} products={products.data?.items ?? []} onEdit={() => setEditing(f.id)} onApprove={(v) => shot && patchShot.mutate({ id: shot.id, patch: { approved: v } })} />; })}
                </div>
              </SortableContext>
            </DndContext>
          </section>

          <div className="rounded-[var(--radius-md)] bg-bg-1 hairline p-4 flex items-center justify-between gap-4">
            <div className="text-[13px] text-fg-1">Next: approve the frames you want, generate keyframes, pick one per frame in Review, then generate clips from the picked keyframes.</div>
            <Button variant="ghost" onClick={() => router.push(`/projects/${id}/campaigns/${campaignId}/shots`)}>Keyframe list <ArrowRight /></Button>
          </div>
        </>
      )}
      <FrameDrawer frame={sb?.shots.find((f) => f.id === editing) ?? null} shotExists={!!(editing && shotById.has(editing))} onOpenChange={(o) => { if (!o) setEditing(null); }} products={products.data?.items ?? []} talent={talent.data?.items ?? []} onChange={(nf) => { if (!sb) return; update({ ...sb, shots: sb.shots.map((f) => (f.id === nf.id ? nf : f)) }); if (shotById.has(nf.id)) patchShot.mutate({ id: nf.id, patch: { title: nf.title, spec: frameToShotPatch(nf) } }); }} />
    </div>
  );
}

function frameToShotPatch(f: StoryboardShot) {
  return { purpose: f.keyframe_prompt_hint || f.subject_action, product_ids: [f.product_placement.product_id], talent_id: f.talent_id, outfit_id: f.outfit_id, lighting: f.lighting, scene: f.scene, camera: { lens_mm: f.lens_mm, aperture: f.aperture, angle: f.angle, shot_size: f.shot_size, focus: f.focus }, crop: f.product_placement.crop, free_text: f.keyframe_prompt_hint || undefined, duration_s: f.duration_s, camera_move: f.camera_move, move_speed: f.move_speed, subject_action: f.subject_action, product_visibility: f.product_placement.visibility, transition_in: f.transition_in, transition_out: f.transition_out, audio_cue: f.audio_cue, text_overlay: f.text_overlay, continuous_with_next: f.continuous_with_next, keyframe_prompt_hint: f.keyframe_prompt_hint, video_prompt_hint: f.video_prompt_hint, format: f.format };
}

function FrameCard({ f, index, aspect, keyframeId, clipId, approved, products, onEdit, onApprove }: { f: StoryboardShot; index: number; aspect: string; keyframeId: string | null; clipId: string | null; approved: boolean; products: ProductLite[]; onEdit: () => void; onApprove: (v: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const [w, h] = aspect.split(":").map(Number);
  const prod = products.find((p) => p.id === f.product_placement.product_id);
  const prim = prod?.refs.find((r) => r.isPrimary) ?? prod?.refs[0];
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("w-[240px] shrink-0 rounded-[var(--radius-md)] bg-bg-1 hairline overflow-hidden flex flex-col", isDragging && "shadow-float z-10 relative", !approved && "opacity-80")}>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-line">
        <button className="cursor-grab text-fg-3 hover:text-fg-1 touch-none" aria-label="Drag" {...attributes} {...listeners}><GripVertical className="size-4" /></button>
        <span className="text-[11px] text-fg-3 tabular">{index + 1}</span>
        <span className="text-[12.5px] font-medium truncate flex-1" title={f.title}>{f.title}</span>
        <span className="text-[11px] text-fg-2 tabular">{f.duration_s}s</span>
        <Switch checked={approved} onCheckedChange={onApprove} />
      </div>
      <AssetThumb asset={clipId ? { id: clipId, kind: "video" } : keyframeId ? { id: keyframeId, kind: "image" } : prim?.asset ?? null} aspect={w / h} rounded={false} onClick={onEdit} className="max-h-[300px]">
        {!keyframeId && !clipId ? <div className="absolute inset-0 bg-black/55 flex items-end p-2 text-[11px] text-white/90 leading-snug">{f.keyframe_prompt_hint || f.subject_action}</div> : null}
        {keyframeId && !clipId ? <Badge tone="ok" className="absolute left-2 top-2"><Check className="size-3" /> keyframe</Badge> : null}
        {clipId ? <Badge tone="ok" className="absolute left-2 top-2"><Check className="size-3" /> clip</Badge> : null}
      </AssetThumb>
      <div className="p-2 space-y-1 text-[11px] text-fg-2">
        <div className="flex flex-wrap gap-1"><Badge>{f.shot_size}</Badge><Badge>{humanize(f.camera_move)}</Badge><Badge>{f.lens_mm}mm {f.aperture}</Badge></div>
        <div className="truncate" title={f.subject_action}>{f.subject_action}</div>
        <div className="flex items-center justify-between"><span>{humanize(f.transition_in)} → {humanize(f.transition_out)}</span><button onClick={onEdit} className="flex items-center gap-1 text-fg-1 hover:text-fg-0 cursor-pointer"><Pencil className="size-3" /> edit</button></div>
      </div>
    </div>
  );
}

function FrameDrawer({ frame, shotExists, onOpenChange, onChange, products, talent }: { frame: StoryboardShot | null; shotExists: boolean; onOpenChange: (o: boolean) => void; onChange: (f: StoryboardShot) => void; products: ProductLite[]; talent: TalentLite[] }) {
  const set = (patch: Partial<StoryboardShot>) => frame && onChange({ ...frame, ...patch });
  const selTalent = talent.find((t) => t.id === frame?.talent_id);
  return (
    <D.Root open={!!frame} onOpenChange={onOpenChange}>
      <Drawer title={frame ? `Frame · ${frame.title}` : "Frame"} width={600}>
        {!frame ? null : (
          <div className="p-5 space-y-5">
            {!shotExists ? <Badge tone="warn">This frame has no keyframe row yet; rewrite the storyboard to sync.</Badge> : null}
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <Field label="Title"><Input value={frame.title} onChange={(e) => set({ title: e.target.value })} /></Field>
              <Field label="Duration (s)"><Input type="number" min={2} max={8} step={0.5} value={frame.duration_s} onChange={(e) => set({ duration_s: Math.min(8, Math.max(2, Number(e.target.value) || 2)) })} /></Field>
            </div>
            <Field label="Keyframe hint" hint="What the still shows. This is the keyframe's purpose."><Textarea rows={2} value={frame.keyframe_prompt_hint} onChange={(e) => set({ keyframe_prompt_hint: e.target.value })} /></Field>
            <Field label="Subject action" hint="The one thing that moves."><Input value={frame.subject_action} onChange={(e) => set({ subject_action: e.target.value })} /></Field>
            <Field label="Motion hint"><Textarea rows={2} value={frame.video_prompt_hint} onChange={(e) => set({ video_prompt_hint: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Shot size"><Select value={frame.shot_size} onChange={(e) => set({ shot_size: e.target.value as StoryboardShot["shot_size"] })}>{SHOT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
              <Field label="Angle"><Select value={frame.angle} onChange={(e) => set({ angle: e.target.value as StoryboardShot["angle"] })}>{ANGLES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select></Field>
              <Field label="Camera move"><Select value={frame.camera_move} onChange={(e) => set({ camera_move: e.target.value as StoryboardShot["camera_move"] })}>{CAMERA_MOVES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select></Field>
              <Field label="Speed"><Select value={frame.move_speed} onChange={(e) => set({ move_speed: e.target.value as "slow" })}><option value="slow">Slow</option><option value="medium">Medium</option></Select></Field>
              <Field label="Lens"><Select value={String(frame.lens_mm)} onChange={(e) => set({ lens_mm: Number(e.target.value) })}>{LENSES.map((l) => <option key={l} value={l}>{l} mm</option>)}</Select></Field>
              <Field label="Aperture"><Select value={frame.aperture} onChange={(e) => set({ aperture: e.target.value as StoryboardShot["aperture"] })}>{APERTURES.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
              <Field label="Focus"><Select value={frame.focus} onChange={(e) => set({ focus: e.target.value as "product" })}><option value="product">Product</option><option value="face">Face</option><option value="rack">Rack</option></Select></Field>
              <Field label="Product"><Select value={frame.product_placement.product_id} onChange={(e) => set({ product_placement: { ...frame.product_placement, product_id: e.target.value } })}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
              <Field label="Visibility"><Select value={frame.product_placement.visibility} onChange={(e) => set({ product_placement: { ...frame.product_placement, visibility: e.target.value as "full" } })}><option value="full">Full</option><option value="partial">Partial</option><option value="reveal">Reveal</option></Select></Field>
              <Field label="Person"><Select value={frame.talent_id ?? ""} onChange={(e) => set({ talent_id: e.target.value || undefined, outfit_id: undefined })}><option value="">None</option>{talent.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
              <Field label="Outfit"><Select value={frame.outfit_id ?? ""} disabled={!selTalent} onChange={(e) => set({ outfit_id: e.target.value || undefined })}><option value="">Default</option>{(selTalent?.outfits ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
              <Field label="Transition in"><Select value={frame.transition_in} onChange={(e) => set({ transition_in: e.target.value as "cut" })}>{["cut", "dissolve", "match_cut", "whip", "light_flare", "fade"].map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select></Field>
              <Field label="Transition out"><Select value={frame.transition_out} onChange={(e) => set({ transition_out: e.target.value as "cut" })}>{["cut", "dissolve", "match_cut", "whip", "light_flare", "fade"].map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select></Field>
              <Field label="Audio cue"><Input value={frame.audio_cue} onChange={(e) => set({ audio_cue: e.target.value })} /></Field>
              <Field label="Continuous with next"><div className="h-9 flex items-center"><Switch checked={frame.continuous_with_next} onCheckedChange={(v) => set({ continuous_with_next: v })} /></div></Field>
            </div>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
              <Field label="Text overlay"><Input value={frame.text_overlay?.copy ?? ""} onChange={(e) => set({ text_overlay: e.target.value ? { copy: e.target.value, position: frame.text_overlay?.position ?? "bottom", in_s: frame.text_overlay?.in_s ?? 0.5, out_s: frame.text_overlay?.out_s ?? 2.5 } : undefined })} /></Field>
              <Field label="Pos."><Select value={frame.text_overlay?.position ?? "bottom"} disabled={!frame.text_overlay} onChange={(e) => frame.text_overlay && set({ text_overlay: { ...frame.text_overlay, position: e.target.value as "bottom" } })}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></Select></Field>
              <Field label="In"><Input type="number" step={0.1} className="w-16" value={frame.text_overlay?.in_s ?? 0.5} disabled={!frame.text_overlay} onChange={(e) => frame.text_overlay && set({ text_overlay: { ...frame.text_overlay, in_s: Number(e.target.value) } })} /></Field>
              <Field label="Out"><Input type="number" step={0.1} className="w-16" value={frame.text_overlay?.out_s ?? 2.5} disabled={!frame.text_overlay} onChange={(e) => frame.text_overlay && set({ text_overlay: { ...frame.text_overlay, out_s: Number(e.target.value) } })} /></Field>
            </div>
            <Field label="Environment"><Input value={frame.scene.environment} onChange={(e) => set({ scene: { ...frame.scene, environment: e.target.value } })} /></Field>
            <div><div className="text-[12px] uppercase tracking-wide text-fg-2 mb-2">Lighting</div><LightingEditor value={frame.lighting} onChange={(l) => set({ lighting: l })} compact /></div>
          </div>
        )}
      </Drawer>
    </D.Root>
  );
}
