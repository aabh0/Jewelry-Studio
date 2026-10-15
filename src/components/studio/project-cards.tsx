"use client";
import * as React from "react";
import Link from "next/link";
import { FolderOpen, Image as ImageIcon, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/hooks/use-api";
import { api, thumbUrl } from "@/lib/api";
import { formatUsd } from "@/lib/money";
import { AssetThumb } from "./asset-thumb";
import { humanize } from "@/domain/taxonomy";

export interface ProjectRow { id: string; name: string; clientName: string | null; coverAssetId: string | null; productCount: number; campaignCount: number; talentCount: number; spendUsd: number; runningJobs: number; lastOpenedAt: number | null; updatedAt: number; archived: number }
export interface ProjectFull extends ProjectRow { brandNotes: string | null; palette: string[]; defaultChannels: string[] }
export interface CampaignLite { id: string; name: string; kind: "image" | "video"; status: string; updatedAt: number; spendUsd: number; shots: { id: string; approved: number; selectedAssetId: string | null; keyframeAssetId: string | null; clipAssetId: string | null; stats: { stage: string; candidates: number; approved: number }[] }[]; productIds: string[]; talent: { talentId: string }[] }
export interface ProductLite { id: string; name: string; sku: string | null; spec: { category: string; subtype?: string; metal: { type: string } }; refs: { assetId: string; role: string; isPrimary: number; asset: { id: string; kind: string; pathRel: string; width: number | null; height: number | null } }[]; validation: { errors: string[]; warnings: string[] } }
export interface TalentLite { id: string; name: string; identityMode: string; soulStatus: string | null; refs: { assetId: string; role: string; asset: { id: string; kind: string; pathRel: string } }[]; outfits: { id: string; name: string }[]; spec: { age_range: string; gender_presentation: string } }

export const STATUS_LABEL: Record<string, string> = { draft: "Draft", shots_pending_approval: "Shots to approve", generating: "Generating", review: "In review", assembling: "Assembling", exported: "Exported", archived: "Archived" };

export function relTime(ts: number) {
  const d = Date.now() - ts;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.round(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} h ago`;
  return `${Math.round(d / 86_400_000)} d ago`;
}

export function campaignProgress(c: CampaignLite) {
  const shots = c.shots.length;
  const approvedShots = c.shots.filter((s) => s.approved).length;
  const candidates = c.shots.reduce((n, s) => n + s.stats.reduce((m, x) => m + x.candidates, 0), 0);
  const selected = c.shots.filter((s) => (c.kind === "video" ? s.clipAssetId : s.selectedAssetId)).length;
  return { shots, approvedShots, candidates, selected };
}

export function ProjectCard({ p }: { p: ProjectRow }) {
  return (
    <Link href={`/projects/${p.id}`} className="group block overflow-hidden rounded-[var(--radius-md)] bg-bg-1 hairline transition-transform duration-[var(--dur-micro)] hover:-translate-y-0.5">
      <div className="relative aspect-[4/3] bg-bg-2">
        {p.coverAssetId ? (
          <img src={thumbUrl(p.coverAssetId, 640)} alt="" className="h-full w-full object-cover transition-transform duration-[var(--dur-large)] group-hover:scale-[1.02]" />
        ) : <div className="flex h-full items-center justify-center text-fg-3"><FolderOpen className="size-8" /></div>}
        {p.runningJobs > 0 ? <Badge tone="accent" className="absolute left-2 top-2">{p.runningJobs} running</Badge> : null}
      </div>
      <div className="p-3">
        <div className="font-display text-[20px] leading-tight text-fg-0 truncate">{p.name}</div>
        <div className="mt-1 text-[12px] text-fg-2 truncate">{p.clientName ?? "—"} · {p.campaignCount} campaigns · {formatUsd(p.spendUsd)}</div>
      </div>
    </Link>
  );
}

export function NewProjectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const [name, setName] = React.useState("");
  const [client, setClient] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const create = useAction((v: { name: string; clientName: string; brandNotes: string }) => api.post<{ id: string }>("/api/projects", v), { invalidate: ["/api/projects"], onSuccess: (r) => { onOpenChange(false); setName(""); setClient(""); setNotes(""); onCreated(r.id); } });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New project" description="One project per client or brand.">
        <div className="space-y-4">
          <Field label="Project name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Maison Lumière — SS27" onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) create.mutate({ name, clientName: client, brandNotes: notes }); }} /></Field>
          <Field label="Client"><Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Maison Lumière" /></Field>
          <Field label="Brand notes" hint="Tone, palette, do's and don'ts. Used by the creative director."><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate({ name, clientName: client, brandNotes: notes })}>Create project</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CampaignCard({ c, projectId }: { c: CampaignLite; projectId: string }) {
  const pr = campaignProgress(c);
  const cover = c.shots.find((s) => s.selectedAssetId || s.keyframeAssetId);
  const coverId = cover?.selectedAssetId ?? cover?.keyframeAssetId ?? null;
  return (
    <Link href={`/projects/${projectId}/campaigns/${c.id}`} className="group flex gap-4 rounded-[var(--radius-md)] bg-bg-1 hairline p-3 transition-transform duration-[var(--dur-micro)] hover:-translate-y-0.5">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-bg-2">
        {coverId ? <img src={thumbUrl(coverId, 256)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-fg-3">{c.kind === "video" ? <Film className="size-6" /> : <ImageIcon className="size-6" />}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><div className="font-display text-[20px] leading-tight truncate">{c.name}</div><Badge tone={c.status === "review" ? "accent" : c.status === "generating" ? "info" : c.status === "exported" ? "ok" : "neutral"}>{STATUS_LABEL[c.status] ?? c.status}</Badge></div>
        <div className="mt-1 text-[12px] text-fg-2">{c.kind === "video" ? "Video" : "Stills"} · {pr.shots} shots · {pr.approvedShots} approved · {pr.candidates} candidates · {pr.selected} picked</div>
        <div className="mt-2 text-[12px] text-fg-2 tabular">{formatUsd(c.spendUsd)} · updated {relTime(c.updatedAt)}</div>
      </div>
    </Link>
  );
}

export function ProductCard({ p, projectId }: { p: ProductLite; projectId: string }) {
  const primary = p.refs.find((r) => r.isPrimary) ?? p.refs[0];
  return (
    <Link href={`/projects/${projectId}/products/${p.id}`} className="group block overflow-hidden rounded-[var(--radius-md)] bg-bg-1 hairline transition-transform duration-[var(--dur-micro)] hover:-translate-y-0.5">
      <AssetThumb asset={primary?.asset ?? null} aspect={1} rounded={false}>{p.validation.errors.length ? <Badge tone="danger" className="absolute left-2 top-2">needs fix</Badge> : null}</AssetThumb>
      <div className="p-3">
        <div className="text-[14px] font-medium truncate">{p.name}</div>
        <div className="mt-0.5 text-[12px] text-fg-2 truncate">{humanize(p.spec.subtype ?? p.spec.category)} · {humanize(p.spec.metal.type)} · {p.refs.length} refs</div>
      </div>
    </Link>
  );
}

export function TalentCard({ t, projectId }: { t: TalentLite; projectId: string }) {
  const primary = t.refs.find((r) => r.role === "front") ?? t.refs[0];
  return (
    <Link href={`/projects/${projectId}/talent/${t.id}`} className="group block overflow-hidden rounded-[var(--radius-md)] bg-bg-1 hairline transition-transform duration-[var(--dur-micro)] hover:-translate-y-0.5">
      <AssetThumb asset={primary?.asset ?? null} aspect={4 / 5} rounded={false}>{t.soulStatus === "ready" ? <Badge tone="ok" className="absolute left-2 top-2">Soul ID</Badge> : null}</AssetThumb>
      <div className="p-3">
        <div className="text-[14px] font-medium truncate">{t.name}</div>
        <div className="mt-0.5 text-[12px] text-fg-2 truncate">{t.spec.age_range} · {t.refs.length} refs · {t.outfits.length} outfits</div>
      </div>
    </Link>
  );
}
