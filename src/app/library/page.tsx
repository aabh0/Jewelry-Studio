"use client";
import * as React from "react";
import { useGet } from "@/hooks/use-api";
import { useUiState } from "@/hooks/use-ui-state";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { AssetDrawer, type AssetFull } from "@/components/studio/asset-drawer";
import { Chip } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/controls";
import type { ProjectRow } from "@/components/studio/project-cards";

const KINDS = [["all", ""], ["images", "image"], ["videos", "video"], ["audio", "audio"]] as const;
const ROLES = [["everything", ""], ["uploads", "upload"], ["generated", "generated"], ["edits", "edit"], ["plates", "plate"], ["sheets", "sheet"], ["renders", "render"], ["exports", "export"]] as const;

export default function LibraryPage() {
  const projects = useGet<{ items: ProjectRow[] }>("/api/projects");
  const [ui, setUi, loaded] = useUiState("library", { project: "", kind: "", role: "", q: "" });
  const [open, setOpen] = React.useState<string | null>(null);
  const projectId = ui.project || projects.data?.items[0]?.id || "";
  const params = new URLSearchParams({ limit: "400" });
  if (ui.kind) params.set("kind", ui.kind);
  if (ui.role) params.set("role", ui.role);
  if (ui.q) params.set("q", ui.q);
  const assets = useGet<{ items: AssetFull[]; total: number }>(loaded && projectId ? `/api/projects/${projectId}/assets?${params.toString()}` : null);
  const items = assets.data?.items ?? [];
  return (
    <div className="mx-auto max-w-[1600px] px-8 py-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[32px] leading-none">Library</h1>
        <div className="flex-1" />
        <Select value={projectId} onChange={(e) => setUi({ project: e.target.value })} className="w-[240px]">{(projects.data?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Input value={ui.q} onChange={(e) => setUi({ q: e.target.value })} placeholder="Search file names and notes" className="w-[260px]" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {KINDS.map(([label, v]) => <Chip key={label} active={ui.kind === v} onClick={() => setUi({ kind: v })}>{label}</Chip>)}
        <span className="mx-2 h-4 w-px bg-line" />
        {ROLES.map(([label, v]) => <Chip key={label} active={ui.role === v} onClick={() => setUi({ role: v })}>{label}</Chip>)}
        <span className="ml-auto text-[12px] text-fg-2 tabular">{assets.data ? `${assets.data.total} assets` : ""}</span>
      </div>
      {!projectId && projects.data ? <EmptyState title="No projects" body="Create a project first; its uploads and generations show up here." /> : assets.isLoading ? (
        <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-7 gap-3">{Array.from({ length: 14 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
      ) : items.length === 0 ? <EmptyState title="Nothing here yet" body="Upload references on a product or person page, or generate a campaign." /> : (
        <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-7 gap-3">
          {items.map((a) => (
            <AssetThumb key={a.id} asset={a} aspect={1} onClick={() => setOpen(a.id)}>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-[11px] text-white/90 truncate">{a.originalName ?? a.role}</div>
            </AssetThumb>
          ))}
        </div>
      )}
      <AssetDrawer assetId={open} onOpenChange={(o) => { if (!o) setOpen(null); }} />
    </div>
  );
}
