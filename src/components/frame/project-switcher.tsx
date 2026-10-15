"use client";
import { FolderOpen, Loader2 } from "lucide-react";
import { CommandDialog, CommandGroup, CommandItem } from "@/components/ui/command";
import { useGet } from "@/hooks/use-api";
import { api } from "@/lib/api";

interface ProjectRow { id: string; name: string; clientName: string | null; runningJobs: number; campaignCount: number; lastOpenedAt: number | null }

export function ProjectSwitcher({ open, onOpenChange, onNavigate }: { open: boolean; onOpenChange: (o: boolean) => void; onNavigate: (href: string) => void }) {
  const projects = useGet<{ items: ProjectRow[] }>(open ? "/api/projects" : null);
  const go = async (p: ProjectRow) => {
    let href = `/projects/${p.id}`;
    try {
      const r = await api.get<{ data: { last_route?: string } | null }>(`/api/ui-state/${encodeURIComponent(`project:${p.id}`)}`);
      if (r.data?.last_route && r.data.last_route.startsWith(`/projects/${p.id}`)) href = r.data.last_route;
    } catch { /* ignore */ }
    onNavigate(href);
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} placeholder="Switch to project…">
      <CommandGroup heading="Projects by last opened">
        {(projects.data?.items ?? []).map((p) => (
          <CommandItem key={p.id} value={`${p.name} ${p.clientName ?? ""}`} onSelect={() => void go(p)} hint={`${p.campaignCount} campaigns`}>
            {p.runningJobs > 0 ? <Loader2 className="animate-spin text-accent" /> : <FolderOpen />} {p.name} {p.clientName ? <span className="text-fg-2">· {p.clientName}</span> : null}
          </CommandItem>
        ))}
      </CommandGroup>
    </CommandDialog>
  );
}
