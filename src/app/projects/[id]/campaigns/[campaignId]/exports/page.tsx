"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import { Download, Check, Crosshair, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/controls";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { useGet, useAction } from "@/hooks/use-api";
import { api, mediaUrl, thumbUrl } from "@/lib/api";
import { CampaignHeader, type Campaign } from "@/components/studio/campaign-nav";
import { RunningJobs } from "@/components/studio/widgets";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { CHANNELS, channelById } from "@/domain/delivery";
import { cn } from "@/lib/cn";

interface ExportRow { id: string; channelId: string; sourceAssetId: string; assetId: string | null; status: string; error: string | null; createdAt: number; paramsJson: string }
interface Candidate { id: string; shotId: string | null; assetId: string; review: string; qaScore: number | null; asset: { id: string; kind: string; pathRel: string; width: number | null; height: number | null } }
interface TimelineRow { renderAssetId: string | null }
interface AssetRow { id: string; kind: string; pathRel: string; width: number | null; height: number | null; originalName: string | null; role: string }

export default function ExportsPage() {
  const { id, campaignId } = useParams<{ id: string; campaignId: string }>();
  const q = useGet<Campaign>(`/api/campaigns/${campaignId}`);
  const c = q.data;
  const isVideo = c?.kind === "video";
  const approved = useGet<{ items: Candidate[] }>(`/api/campaigns/${campaignId}/candidates?review=approved&limit=500`);
  const tl = useGet<TimelineRow>(isVideo ? `/api/campaigns/${campaignId}/timeline` : null);
  const videos = useGet<{ items: AssetRow[] }>(isVideo ? `/api/projects/${id}/assets?kind=video&role=render,edit&limit=100` : null);
  const exportsQ = useGet<{ items: ExportRow[] }>(`/api/campaigns/${campaignId}/exports`, { refetchInterval: 4000 });
  const [picked, setPicked] = React.useState<string[]>([]);
  const [channels, setChannels] = React.useState<string[] | null>(null);
  const [focal, setFocal] = React.useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const chans = channels ?? (c?.brief.channels.length ? c.brief.channels : ["ig_feed_45"]);
  const sources = React.useMemo(() => {
    const out: { id: string; kind: string; pathRel: string; width: number | null; height: number | null; label: string; primary: boolean }[] = [];
    if (!c) return out;
    if (isVideo) {
      const render = tl.data?.renderAssetId ? videos.data?.items.find((a) => a.id === tl.data!.renderAssetId) : null;
      if (render) out.push({ ...render, label: "Final render", primary: true });
      for (const s of c.shots) { const cand = approved.data?.items.find((x) => x.assetId === s.clipAssetId); if (s.clipAssetId && cand) out.push({ ...cand.asset, label: `Clip · ${s.title}`, primary: false }); }
    } else {
      for (const s of c.shots) for (const cand of (approved.data?.items ?? []).filter((x) => x.shotId === s.id)) out.push({ ...cand.asset, label: `${s.title}${cand.assetId === s.selectedAssetId ? " · pick" : ""}`, primary: cand.assetId === s.selectedAssetId });
    }
    return out;
  }, [c, isVideo, approved.data, tl.data, videos.data]);
  React.useEffect(() => { if (picked.length === 0 && sources.length) setPicked(sources.filter((s) => s.primary).map((s) => s.id)); }, [sources, picked.length]);
  const run = useAction(() => api.post<{ job_ids: string[] }>(`/api/campaigns/${campaignId}/exports`, { channel_ids: chans, asset_ids: picked, focal, shot_titles: Object.fromEntries(sources.map((s) => [s.id, s.label])) }), { invalidate: ["/api/jobs", "/api/campaigns"], success: (r) => `Queued ${r.job_ids.length} exports` });
  if (!c) return <div className="mx-auto max-w-[1300px] px-8 py-8"><Skeleton className="h-12 w-96" /><Skeleton className="mt-6 h-[480px]" /></div>;
  const first = sources.find((s) => s.id === picked[0]);
  const rows = exportsQ.data?.items ?? [];
  return (
    <div className="mx-auto max-w-[1300px] px-8 py-8 space-y-6">
      <CampaignHeader c={c} right={<Button variant="primary" disabled={picked.length === 0 || chans.length === 0 || run.isPending} onClick={() => run.mutate()}><Package /> Export {picked.length} × {chans.length}</Button>} />
      <RunningJobs projectId={id} campaignId={campaignId} />
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-6">
          <section className="space-y-3">
            <SectionTitle right={<span className="text-[12px] text-fg-2">{picked.length} selected · <button className="hover:text-fg-0 cursor-pointer" onClick={() => setPicked(sources.map((s) => s.id))}>all</button> · <button className="hover:text-fg-0 cursor-pointer" onClick={() => setPicked([])}>none</button></span>}>Approved sources</SectionTitle>
            {sources.length === 0 ? <EmptyState title="Nothing approved yet" body={isVideo ? "Render the final cut in Assemble, or approve clips in Review." : "Approve candidates in Review; approved ones show up here."} /> : (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">{sources.map((s) => { const on = picked.includes(s.id); return <AssetThumb key={s.id} asset={s} aspect={isVideo ? 9 / 16 : 4 / 5} selected={on} onClick={() => setPicked(on ? picked.filter((x) => x !== s.id) : [...picked, s.id])}><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-[11px] text-white truncate">{s.label}</div>{on ? <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg"><Check className="size-3" /></span> : null}</AssetThumb>; })}</div>
            )}
          </section>
          <section className="space-y-3">
            <SectionTitle>Exports</SectionTitle>
            {rows.length === 0 ? <div className="text-[12px] text-fg-3">No exports yet. Files land in the project&apos;s exports folder, named by channel and shot.</div> : (
              <div className="space-y-1.5">{rows.map((r) => <ExportLine key={r.id} r={r} />)}</div>
            )}
          </section>
        </div>
        <aside className="space-y-4">
          <section className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-5 space-y-3">
            <SectionTitle>Channels</SectionTitle>
            <div className="flex flex-wrap gap-1.5">{CHANNELS.filter((ch) => (isVideo ? ch.kind !== "image" : ch.kind !== "video")).map((ch) => <Chip key={ch.id} active={chans.includes(ch.id)} onClick={() => setChannels(chans.includes(ch.id) ? chans.filter((x) => x !== ch.id) : [...chans, ch.id])}>{ch.label}</Chip>)}</div>
            <div className="text-[11px] text-fg-3">{chans.map((cid) => channelById(cid)).filter(Boolean).map((ch) => `${ch!.label}: ${ch!.width ? `${ch!.width}×${ch!.height}` : "native"} ${ch!.format}`).join(" · ")}</div>
          </section>
          <section className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-5 space-y-3">
            <SectionTitle><span className="flex items-center gap-2"><Crosshair className="size-4 text-fg-2" /> Focal point</span></SectionTitle>
            <p className="text-[12px] text-fg-2">Click where the product is. Crops for every aspect keep this point in frame and inside each channel&apos;s safe zone.</p>
            {first ? (
              <div className="relative overflow-hidden rounded-[var(--radius-md)] bg-bg-2 cursor-crosshair" style={{ aspectRatio: first.width && first.height ? first.width / first.height : 1 }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setFocal({ x: +((e.clientX - r.left) / r.width).toFixed(3), y: +((e.clientY - r.top) / r.height).toFixed(3) }); }}>
                <img src={thumbUrl(first.id, 768)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-float" style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }} />
                {chans.map((cid) => { const ch = channelById(cid); if (!ch || !ch.width || !first.width || !first.height) return null; const src = first.width / first.height; const dst = ch.width / ch.height; const w = dst < src ? dst / src : 1; const h = dst < src ? 1 : src / dst; const left = Math.min(1 - w, Math.max(0, focal.x - w / 2)); const top = Math.min(1 - h, Math.max(0, focal.y - h / 2)); return <span key={cid} className="absolute border border-white/60 pointer-events-none" style={{ left: `${left * 100}%`, top: `${top * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }} title={ch.label} />; })}
              </div>
            ) : <div className="text-[12px] text-fg-3">Select a source first.</div>}
            <div className="text-[11px] text-fg-3 tabular">x {focal.x} · y {focal.y}</div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ExportLine({ r }: { r: ExportRow }) {
  const asset = useGet<{ pathRel: string; bytes: number; width: number | null; height: number | null }>(r.assetId && r.status === "succeeded" ? `/api/assets/${r.assetId}` : null);
  const ch = channelById(r.channelId);
  const params = JSON.parse(r.paramsJson || "{}") as { shot_title?: string };
  return (
    <div className={cn("flex items-center gap-3 rounded-[var(--radius-md)] bg-bg-1 hairline px-3 py-2")}>
      <AssetThumb asset={{ id: r.assetId ?? r.sourceAssetId, kind: ch?.format === "mp4" ? "video" : "image" }} aspect={1} className="size-10 shrink-0" />
      <div className="min-w-0 flex-1"><div className="text-[13px] truncate">{ch?.label ?? r.channelId}{params.shot_title ? ` · ${params.shot_title}` : ""}</div><div className="text-[11px] text-fg-3">{asset.data ? `${asset.data.width}×${asset.data.height} · ${(asset.data.bytes / 1024).toFixed(0)} KB` : new Date(r.createdAt).toLocaleString()}{r.error ? ` · ${r.error}` : ""}</div></div>
      <Badge tone={r.status === "succeeded" ? "ok" : r.status === "failed" ? "danger" : r.status === "running" ? "accent" : "neutral"}>{r.status}</Badge>
      {asset.data ? <a href={mediaUrl(asset.data.pathRel)} download className="flex items-center gap-1 text-[12px] text-fg-1 hover:text-fg-0"><Download className="size-3.5" /> Download</a> : null}
    </div>
  );
}
