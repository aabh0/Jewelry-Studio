"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { GripVertical, Trash2, Plus, Play, Film, RotateCcw, Music, Type, ArrowRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch, Skeleton } from "@/components/ui/controls";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel } from "@/components/ui/menu";
import { useGet, useAction, useAutosave } from "@/hooks/use-api";
import { api, mediaUrl } from "@/lib/api";
import { CampaignHeader, type Campaign } from "@/components/studio/campaign-nav";
import { RunningJobs } from "@/components/studio/widgets";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { VideoPlayer } from "@/components/studio/video-player";
import { Dropzone } from "@/components/studio/dropzone";
import { CHANNELS, ASPECT_DIMS } from "@/domain/delivery";
import { TRANSITIONS, zTimeline, type Timeline, type TimelineClip, type TextOverlay } from "@/domain/timeline";
import { humanize } from "@/domain/taxonomy";
import { cn } from "@/lib/cn";

interface TimelineRow { id: string | null; campaignId: string; timeline: Timeline; status: string; renderAssetId: string | null; previewAssetId: string | null }
interface AssetRow { id: string; kind: string; pathRel: string; width: number | null; height: number | null; durationMs: number | null; originalName: string | null; role: string }

export default function AssemblePage() {
  const { id, campaignId } = useParams<{ id: string; campaignId: string }>();
  const router = useRouter();
  const q = useGet<Campaign>(`/api/campaigns/${campaignId}`);
  const tq = useGet<TimelineRow>(`/api/campaigns/${campaignId}/timeline`, { refetchInterval: 6000 });
  const clipsQ = useGet<{ items: AssetRow[] }>(`/api/projects/${id}/assets?kind=video&limit=500`);
  const audioQ = useGet<{ items: AssetRow[] }>(`/api/projects/${id}/assets?kind=audio&limit=100`);
  const revisions = useGet<{ items: { id: string; revision: number; createdAt: number }[] }>(tq.data?.id ? `/api/revisions/timeline/${tq.data.id}` : null);
  const [tl, setTl] = React.useState<Timeline | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const c = q.data;
  React.useEffect(() => { if (tq.data && !tl) setTl(tq.data.timeline); }, [tq.data, tl]);
  const { save, flush } = useAutosave<{ timeline: Timeline }>((p) => api.put(`/api/campaigns/${campaignId}/timeline`, p.timeline).then(() => undefined), 700);
  const update = (next: Timeline) => { setTl(next); save({ timeline: next }); };
  const render = useAction(async (preview: boolean) => { await flush(); return api.post(`/api/campaigns/${campaignId}/render`, { preview }); }, { invalidate: ["/api/jobs", "/api/campaigns"], success: "Render queued" });
  const restore = useAction(async (revId: string) => { const r = await api.get<{ data: Timeline }>(`/api/revisions/item/${revId}`); await api.put(`/api/campaigns/${campaignId}/timeline`, r.data); return r.data; }, { invalidate: ["/api/campaigns", "/api/revisions"], success: "Revision restored", onSuccess: (d) => setTl(d) });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const assetsById = React.useMemo(() => new Map([...(clipsQ.data?.items ?? []), ...(audioQ.data?.items ?? [])].map((a) => [a.id, a])), [clipsQ.data, audioQ.data]);
  if (!c || !tl) return <div className="mx-auto max-w-[1300px] px-8 py-8"><Skeleton className="h-12 w-96" /><Skeleton className="mt-6 h-[480px]" /></div>;
  const approvedClips = c.shots.filter((s) => s.clipAssetId).map((s) => ({ shot: s, assetId: s.clipAssetId! }));
  const rebuild = () => {
    const clips: TimelineClip[] = approvedClips.map(({ shot, assetId }) => { const t = shot.spec.transition_in ?? "cut"; const type = t === "dissolve" ? "dissolve" : t === "fade" ? "fade" : t === "light_flare" ? "fadeblack" : t === "whip" ? "wipeleft" : "cut"; return { asset_id: assetId, in_s: 0, out_s: shot.spec.duration_s, fit: "cover", speed: 1, overlays: shot.spec.text_overlay ? [{ kind: "text", copy: shot.spec.text_overlay.copy, font: "InstrumentSerif-Regular", size_px: 64, color: "#F5F3EE", position: shot.spec.text_overlay.position, in_s: shot.spec.text_overlay.in_s, out_s: shot.spec.text_overlay.out_s }] : [], transition_in: type === "cut" ? undefined : { type: type as "fade", duration_s: 0.5 } }; });
    update(zTimeline.parse({ ...tl, clips }));
  };
  const clipLen = (cl: TimelineClip) => { const a = assetsById.get(cl.asset_id); const nat = a?.durationMs ? a.durationMs / 1000 : (cl.out_s ?? 4); const end = Math.min(cl.out_s ?? nat, nat); return Math.max(0, end - cl.in_s) / (cl.speed || 1); };
  const total = tl.clips.reduce((n, cl, i) => n + clipLen(cl) - (i > 0 && cl.transition_in ? cl.transition_in.duration_s : 0), 0) + (tl.end_card?.duration_s ?? 0);
  const onDragEnd = (e: DragEndEvent) => { const { active, over } = e; if (!over || active.id === over.id) return; const from = Number(String(active.id).split(":")[0]); const to = Number(String(over.id).split(":")[0]); update({ ...tl, clips: arrayMove(tl.clips, from, to) }); };
  const setClip = (i: number, patch: Partial<TimelineClip>) => update({ ...tl, clips: tl.clips.map((cl, j) => (j === i ? { ...cl, ...patch } : cl)) });
  const channel = CHANNELS.find((ch) => ch.id === tl.output.channel_id);
  const row = tq.data!;
  const preview = row.previewAssetId ? assetsById.get(row.previewAssetId) : null;
  const final = row.renderAssetId ? assetsById.get(row.renderAssetId) : null;
  return (
    <div className="mx-auto max-w-[1300px] px-8 py-8 space-y-6">
      <CampaignHeader c={c} right={<>
        <Menu>
          <MenuTrigger asChild><Button variant="ghost" disabled={!revisions.data?.items.length}><History /> Revisions</Button></MenuTrigger>
          <MenuContent><MenuLabel>Restore a version</MenuLabel>{(revisions.data?.items ?? []).slice(0, 12).map((r) => <MenuItem key={r.id} onSelect={() => restore.mutate(r.id)}>v{r.revision} · {new Date(r.createdAt).toLocaleString()}</MenuItem>)}</MenuContent>
        </Menu>
        <Button variant="ghost" disabled={tl.clips.length === 0 || render.isPending} onClick={() => render.mutate(true)}><Play /> Preview (fast)</Button>
        <Button variant="primary" disabled={tl.clips.length === 0 || render.isPending} onClick={() => render.mutate(false)}><Film /> Render final</Button>
      </>} />
      <RunningJobs projectId={id} campaignId={campaignId} />
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
        <div className="space-y-6">
          <section className="space-y-3">
            <SectionTitle right={<div className="flex items-center gap-2"><Button size="sm" variant="ghost" onClick={rebuild} disabled={approvedClips.length === 0}><RotateCcw /> Rebuild from picked clips</Button><Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}><Plus /> Add clip</Button></div>}>Timeline <span className="ml-2 text-[12px] font-normal text-fg-2 tabular">{total.toFixed(1)} s{channel?.maxVideoS && total > channel.maxVideoS ? <span className="text-warn"> · over the {channel.maxVideoS}s limit for {channel.label}</span> : null}</span></SectionTitle>
            {tl.clips.length === 0 ? <EmptyState title="Empty timeline" body={approvedClips.length ? "Rebuild from the clips you picked in Review, or add clips by hand." : "Pick a clip per frame in Review first."} action={approvedClips.length ? <Button variant="primary" onClick={rebuild}><RotateCcw /> Build from picked clips</Button> : <Button variant="primary" onClick={() => router.push(`/projects/${id}/campaigns/${campaignId}/review?stage=clips`)}>Go to Review</Button>} /> : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
                <SortableContext items={tl.clips.map((cl, i) => `${i}:${cl.asset_id}`)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">{tl.clips.map((cl, i) => <ClipRow key={`${i}:${cl.asset_id}`} sortId={`${i}:${cl.asset_id}`} index={i} clip={cl} asset={assetsById.get(cl.asset_id)} shotTitle={c.shots.find((s) => s.clipAssetId === cl.asset_id)?.title} len={clipLen(cl)} onChange={(p) => setClip(i, p)} onRemove={() => update({ ...tl, clips: tl.clips.filter((_, j) => j !== i) })} />)}</div>
                </SortableContext>
              </DndContext>
            )}
          </section>
          {(preview || final) ? (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {preview ? <div className="space-y-2"><div className="text-[12px] uppercase tracking-wide text-fg-2">Preview (540p)</div><VideoPlayer pathRel={preview.pathRel} className="rounded-[var(--radius-md)] overflow-hidden" /></div> : null}
              {final ? <div className="space-y-2"><div className="flex items-center justify-between"><div className="text-[12px] uppercase tracking-wide text-fg-2">Final render</div><a className="text-[12px] text-accent hover:underline" href={mediaUrl(final.pathRel)} download>Download</a></div><VideoPlayer pathRel={final.pathRel} className="rounded-[var(--radius-md)] overflow-hidden" /></div> : null}
            </section>
          ) : null}
        </div>
        <aside className="space-y-4">
          <section className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-5 space-y-3">
            <SectionTitle>Output</SectionTitle>
            <Field label="Channel"><Select value={tl.output.channel_id ?? ""} onChange={(e) => { const ch = CHANNELS.find((x) => x.id === e.target.value); update({ ...tl, output: { ...tl.output, channel_id: ch?.id, ...(ch && ch.width ? { width: ch.width, height: ch.height } : {}) } }); }}><option value="">Custom</option>{CHANNELS.filter((ch) => ch.kind !== "image" && ch.id !== "master").map((ch) => <option key={ch.id} value={ch.id}>{ch.label}</option>)}</Select></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Width"><Input type="number" value={tl.output.width} onChange={(e) => update({ ...tl, output: { ...tl.output, width: Number(e.target.value) || 1080, channel_id: undefined } })} /></Field>
              <Field label="Height"><Input type="number" value={tl.output.height} onChange={(e) => update({ ...tl, output: { ...tl.output, height: Number(e.target.value) || 1920, channel_id: undefined } })} /></Field>
              <Field label="FPS"><Select value={String(tl.output.fps)} onChange={(e) => update({ ...tl, output: { ...tl.output, fps: Number(e.target.value) } })}>{[24, 25, 30, 60].map((f) => <option key={f} value={f}>{f}</option>)}</Select></Field>
            </div>
            <div className="flex flex-wrap gap-1">{Object.entries(ASPECT_DIMS).map(([a, [w, h]]) => <button key={a} className={cn("rounded-full px-2 h-6 text-[11px] hairline cursor-pointer", tl.output.width === w && tl.output.height === h ? "bg-bg-3 text-fg-0" : "text-fg-2 hover:text-fg-0")} onClick={() => update({ ...tl, output: { ...tl.output, width: w, height: h, channel_id: undefined } })}>{a}</button>)}</div>
          </section>
          <section className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-5 space-y-3">
            <SectionTitle><span className="flex items-center gap-2"><Music className="size-4 text-fg-2" /> Music</span></SectionTitle>
            <Select value={tl.music?.asset_id ?? ""} onChange={(e) => update({ ...tl, music: e.target.value ? { offset_s: 0, volume: 0.8, fade_in_s: 1, fade_out_s: 2, mode: "replace", ...(tl.music ?? {}), asset_id: e.target.value } : undefined })}><option value="">No music</option>{(audioQ.data?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.originalName ?? a.id}</option>)}</Select>
            <Dropzone projectId={id} role="music" accept="audio/*" multiple={false} compact label="Upload a track (your license)" onUploaded={(as) => { const a = as[0]; if (a) update({ ...tl, music: { asset_id: a.id, offset_s: 0, volume: 0.8, fade_in_s: 1, fade_out_s: 2, mode: "replace" } }); }} />
            {tl.music ? <div className="grid grid-cols-2 gap-2">
              <Field label="Offset (s)"><Input type="number" step={0.5} value={tl.music.offset_s} onChange={(e) => update({ ...tl, music: { ...tl.music!, offset_s: Number(e.target.value) || 0 } })} /></Field>
              <Field label="Volume"><Input type="number" step={0.1} min={0} max={2} value={tl.music.volume} onChange={(e) => update({ ...tl, music: { ...tl.music!, volume: Number(e.target.value) || 0 } })} /></Field>
              <Field label="Fade in (s)"><Input type="number" step={0.5} value={tl.music.fade_in_s} onChange={(e) => update({ ...tl, music: { ...tl.music!, fade_in_s: Number(e.target.value) || 0 } })} /></Field>
              <Field label="Fade out (s)"><Input type="number" step={0.5} value={tl.music.fade_out_s} onChange={(e) => update({ ...tl, music: { ...tl.music!, fade_out_s: Number(e.target.value) || 0 } })} /></Field>
              <Field label="Mode"><Select value={tl.music.mode} onChange={(e) => update({ ...tl, music: { ...tl.music!, mode: e.target.value as "replace" } })}><option value="replace">Replace clip audio</option><option value="duck">Duck under clip audio</option><option value="mix">Mix</option></Select></Field>
            </div> : null}
            <div className="flex items-center gap-2 text-[12px] text-fg-1"><Switch checked={tl.keep_clip_audio} onCheckedChange={(v) => update({ ...tl, keep_clip_audio: v })} /> Keep generated clip audio</div>
          </section>
          <section className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-5 space-y-3">
            <SectionTitle right={<Switch checked={!!tl.end_card} onCheckedChange={(v) => update({ ...tl, end_card: v ? { duration_s: 1.5, bg_color: "#0C0C0D", copy: c.storyboard?.end_card?.copy ?? c.name, fade_in_s: 0.3 } : undefined })} />}><span className="flex items-center gap-2"><Type className="size-4 text-fg-2" /> End card</span></SectionTitle>
            {tl.end_card ? <div className="space-y-2">
              <Field label="Copy"><Input value={tl.end_card.copy ?? ""} onChange={(e) => update({ ...tl, end_card: { ...tl.end_card!, copy: e.target.value || undefined } })} /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Seconds"><Input type="number" step={0.5} value={tl.end_card.duration_s} onChange={(e) => update({ ...tl, end_card: { ...tl.end_card!, duration_s: Number(e.target.value) || 1 } })} /></Field>
                <Field label="Background"><Input value={tl.end_card.bg_color} onChange={(e) => update({ ...tl, end_card: { ...tl.end_card!, bg_color: e.target.value } })} /></Field>
                <Field label="Fade in"><Input type="number" step={0.1} value={tl.end_card.fade_in_s} onChange={(e) => update({ ...tl, end_card: { ...tl.end_card!, fade_in_s: Number(e.target.value) || 0 } })} /></Field>
              </div>
              <Dropzone projectId={id} role="logo" accept="image/*" multiple={false} compact label={tl.end_card.logo_asset_id ? "Replace logo" : "Add a logo (PNG)"} onUploaded={(as) => { const a = as[0]; if (a) update({ ...tl, end_card: { ...tl.end_card!, logo_asset_id: a.id } }); }} />
            </div> : null}
          </section>
          {final ? <Button variant="primary" className="w-full" onClick={() => router.push(`/projects/${id}/campaigns/${campaignId}/exports`)}>Export the render per channel <ArrowRight /></Button> : null}
        </aside>
      </div>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent title="Add a clip" description="Any video in this project: generated clips, edits, uploads." wide>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto">
            {(clipsQ.data?.items ?? []).filter((a) => a.role !== "render" && a.role !== "export").map((a) => <AssetThumb key={a.id} asset={a} aspect={9 / 16} onClick={() => { update({ ...tl, clips: [...tl.clips, { asset_id: a.id, in_s: 0, fit: "cover", speed: 1, overlays: [] }] }); setAddOpen(false); }}><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-[11px] text-white truncate">{c.shots.find((s) => s.clipAssetId === a.id)?.title ?? a.originalName ?? a.role}</div></AssetThumb>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClipRow({ sortId, index, clip, asset, shotTitle, len, onChange, onRemove }: { sortId: string; index: number; clip: TimelineClip; asset: AssetRow | undefined; shotTitle?: string; len: number; onChange: (p: Partial<TimelineClip>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });
  const nat = asset?.durationMs ? asset.durationMs / 1000 : undefined;
  const ov = clip.overlays[0];
  const setOv = (p: Partial<TextOverlay> | null) => { const base: TextOverlay = ov ?? { kind: "text", copy: "", font: "InstrumentSerif-Regular", size_px: 64, color: "#F5F3EE", position: "bottom", in_s: 0.3, out_s: 2.5 }; onChange({ overlays: p === null ? [] : [{ ...base, ...p }] }); };
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("rounded-[var(--radius-md)] bg-bg-1 hairline p-2 flex gap-3", isDragging && "shadow-float z-10 relative")}>
      <button className="cursor-grab text-fg-3 hover:text-fg-1 self-center touch-none" aria-label="Drag" {...attributes} {...listeners}><GripVertical className="size-4" /></button>
      <AssetThumb asset={asset ? { ...asset, kind: "video" } : { id: clip.asset_id, kind: "video" }} aspect={9 / 16} className="w-16 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2 text-[12.5px]"><span className="text-fg-3 tabular">{index + 1}</span><span className="font-medium truncate">{shotTitle ?? asset?.originalName ?? clip.asset_id}</span><Badge>{len.toFixed(1)}s</Badge>{nat ? <span className="text-[11px] text-fg-3">of {nat.toFixed(1)}s</span> : null}<Button size="icon-sm" variant="ghost" className="ml-auto" aria-label="Remove" onClick={onRemove}><Trash2 /></Button></div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <Field label="In (s)"><Input type="number" step={0.1} min={0} value={clip.in_s} onChange={(e) => onChange({ in_s: Math.max(0, Number(e.target.value) || 0) })} /></Field>
          <Field label="Out (s)"><Input type="number" step={0.1} min={0} value={clip.out_s ?? ""} placeholder={nat?.toFixed(1)} onChange={(e) => onChange({ out_s: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          <Field label="Speed"><Select value={String(clip.speed)} onChange={(e) => onChange({ speed: Number(e.target.value) })}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => <option key={s} value={s}>{s}×</option>)}</Select></Field>
          <Field label="Fit"><Select value={clip.fit} onChange={(e) => onChange({ fit: e.target.value as "cover" })}><option value="cover">Cover</option><option value="contain">Contain</option></Select></Field>
          <Field label="Transition in"><Select value={clip.transition_in?.type ?? "cut"} disabled={index === 0} onChange={(e) => onChange({ transition_in: e.target.value === "cut" ? undefined : { type: e.target.value as "fade", duration_s: clip.transition_in?.duration_s ?? 0.5 } })}>{TRANSITIONS.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select></Field>
          <Field label="Length (s)"><Input type="number" step={0.1} min={0.1} max={2} disabled={!clip.transition_in} value={clip.transition_in?.duration_s ?? 0.5} onChange={(e) => clip.transition_in && onChange({ transition_in: { ...clip.transition_in, duration_s: Number(e.target.value) || 0.5 } })} /></Field>
        </div>
        <div className="grid grid-cols-[1fr_110px_110px_70px_70px_auto] gap-2 items-end">
          <Field label="Text overlay"><Input value={ov?.copy ?? ""} onChange={(e) => (e.target.value ? setOv({ copy: e.target.value }) : setOv(null))} placeholder="Optional on-screen copy" /></Field>
          <Field label="Font"><Select value={ov?.font ?? "InstrumentSerif-Regular"} disabled={!ov} onChange={(e) => setOv({ font: e.target.value as "Inter-Regular" })}><option value="InstrumentSerif-Regular">Serif</option><option value="Inter-Regular">Sans</option><option value="Inter-SemiBold">Sans bold</option></Select></Field>
          <Field label="Position"><Select value={ov?.position ?? "bottom"} disabled={!ov} onChange={(e) => setOv({ position: e.target.value as "bottom" })}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></Select></Field>
          <Field label="In"><Input type="number" step={0.1} disabled={!ov} value={ov?.in_s ?? 0.3} onChange={(e) => setOv({ in_s: Number(e.target.value) || 0 })} /></Field>
          <Field label="Out"><Input type="number" step={0.1} disabled={!ov} value={ov?.out_s ?? 2.5} onChange={(e) => setOv({ out_s: Number(e.target.value) || 0 })} /></Field>
          <Field label="Size"><Input type="number" className="w-20" disabled={!ov} value={ov?.size_px ?? 64} onChange={(e) => setOv({ size_px: Number(e.target.value) || 64 })} /></Field>
        </div>
      </div>
    </div>
  );
}
