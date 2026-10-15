"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { useGet } from "@/hooks/use-api";
import { thumbUrl } from "@/lib/api";
import { formatUsd } from "@/lib/money";

import { Skeleton } from "@/components/ui/controls";
import { RunningJobs } from "@/components/studio/widgets";
import { ProjectCard, NewProjectDialog, type ProjectRow } from "@/components/studio/project-cards";

export default function HomePage() {
  const projects = useGet<{ items: ProjectRow[] }>("/api/projects");
  const global = useGet<{ data: { last_project_id?: string } | null }>("/api/ui-state/global");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const items = projects.data?.items ?? [];
  const last = items.find((p) => p.id === global.data?.data?.last_project_id) ?? items[0];
  const lastRoute = useGet<{ data: { last_route?: string } | null }>(last ? `/api/ui-state/${encodeURIComponent(`project:${last.id}`)}` : null);
  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8 space-y-10">
      {projects.isLoading ? <Skeleton className="h-[220px] w-full rounded-[var(--radius-lg)]" /> : last ? (
        <section className="relative overflow-hidden rounded-[var(--radius-lg)] hairline rise-in" style={{ minHeight: 220 }}>
          {last.coverAssetId ? (
            <img src={thumbUrl(last.coverAssetId, 1200)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 blur-[18px] scale-110" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-bg-0 via-bg-0/80 to-transparent" />
          <div className="relative flex items-end justify-between gap-6 p-8">
            <div>
              <div className="text-[12px] uppercase tracking-wide text-fg-2">Continue where you left off</div>
              <h1 className="mt-2 font-display text-[40px] leading-none text-fg-0">{last.name}</h1>
              <div className="mt-2 text-[13px] text-fg-1">{last.clientName ? `${last.clientName} · ` : ""}{last.campaignCount} campaigns · {last.productCount} products · {formatUsd(last.spendUsd)} spent{last.runningJobs ? ` · ${last.runningJobs} running` : ""}</div>
            </div>
            <Button variant="primary" size="lg" onClick={() => router.push(lastRoute.data?.data?.last_route ?? `/projects/${last.id}`)}>Resume <ArrowRight /></Button>
          </div>
        </section>
      ) : null}
      <RunningJobs limit={4} />
      <section>
        <div className="mb-4 flex items-end justify-between"><h2 className="font-display text-[26px] leading-none">Projects</h2><Button variant="primary" onClick={() => setOpen(true)}><Plus /> New project</Button></div>
        {projects.isLoading ? <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3]" />)}</div> : items.length === 0 ? (
          <EmptyState title="No projects yet" body="A project holds one client's products, people and campaigns. Everything in it autosaves." action={<Button variant="primary" onClick={() => setOpen(true)}><Plus /> Create your first project</Button>} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">{items.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
        )}
      </section>
      <NewProjectDialog open={open} onOpenChange={setOpen} onCreated={(id) => router.push(`/projects/${id}`)} />
    </div>
  );
}
