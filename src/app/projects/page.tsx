"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/empty";
import { useGet } from "@/hooks/use-api";
import { ProjectCard, NewProjectDialog, type ProjectRow } from "@/components/studio/project-cards";

export default function ProjectsPage() {
  const [archived, setArchived] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const projects = useGet<{ items: ProjectRow[] }>(`/api/projects${archived ? "?archived=1" : ""}`);
  const items = (projects.data?.items ?? []).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.clientName ?? "").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <div className="mb-5 flex items-center gap-3">
        <h1 className="font-display text-[32px] leading-none">Projects</h1>
        <div className="flex-1" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-56" />
        <label className="flex items-center gap-2 text-[12px] text-fg-1"><Switch checked={archived} onCheckedChange={setArchived} /> Show archived</label>
        <Button variant="primary" onClick={() => setOpen(true)}><Plus /> New project</Button>
      </div>
      {items.length === 0 ? <EmptyState title="Nothing here" body={q ? "No project matches your search." : "Create a project to begin."} /> : <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">{items.map((p) => <ProjectCard key={p.id} p={p} />)}</div>}
      <NewProjectDialog open={open} onOpenChange={setOpen} onCreated={(id) => router.push(`/projects/${id}`)} />
    </div>
  );
}
