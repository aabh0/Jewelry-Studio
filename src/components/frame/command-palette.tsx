"use client";
import * as React from "react";
import { FolderOpen, Images, ListChecks, Settings, Sun, Sparkles, Gem, Users, Clapperboard } from "lucide-react";
import { CommandDialog, CommandGroup, CommandItem } from "@/components/ui/command";
import { useGet } from "@/hooks/use-api";

interface ProjectRow { id: string; name: string; clientName: string | null }
interface CampaignRow { id: string; name: string; kind: string }
interface ProductRow { id: string; name: string }
interface TalentRow { id: string; name: string }

export function CommandPalette({ open, onOpenChange, projectId, onNavigate, onToggleTheme }: { open: boolean; onOpenChange: (o: boolean) => void; projectId?: string; onNavigate: (href: string) => void; onToggleTheme: () => void }) {
  const projects = useGet<{ items: ProjectRow[] }>(open ? "/api/projects" : null);
  const campaigns = useGet<{ items: CampaignRow[] }>(open && projectId ? `/api/projects/${projectId}/campaigns` : null);
  const products = useGet<{ items: ProductRow[] }>(open && projectId ? `/api/projects/${projectId}/products` : null);
  const talent = useGet<{ items: TalentRow[] }>(open && projectId ? `/api/projects/${projectId}/talent` : null);
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandGroup heading="Go to">
        <CommandItem onSelect={() => onNavigate("/")}><FolderOpen /> Home</CommandItem>
        <CommandItem onSelect={() => onNavigate("/library")}><Images /> Library</CommandItem>
        <CommandItem onSelect={() => onNavigate("/jobs")}><ListChecks /> Jobs</CommandItem>
        <CommandItem onSelect={() => onNavigate("/settings")}><Settings /> Settings</CommandItem>
        <CommandItem onSelect={() => { onToggleTheme(); onOpenChange(false); }}><Sun /> Toggle theme</CommandItem>
      </CommandGroup>
      {projectId ? (
        <CommandGroup heading="This project">
          <CommandItem onSelect={() => onNavigate(`/projects/${projectId}/campaigns/new`)}><Sparkles /> New campaign</CommandItem>
          <CommandItem onSelect={() => onNavigate(`/projects/${projectId}/products/new`)}><Gem /> New product</CommandItem>
          <CommandItem onSelect={() => onNavigate(`/projects/${projectId}/talent/new`)}><Users /> New person</CommandItem>
          {(campaigns.data?.items ?? []).map((c) => <CommandItem key={c.id} value={`campaign ${c.name}`} onSelect={() => onNavigate(`/projects/${projectId}/campaigns/${c.id}`)} hint={c.kind}><Clapperboard /> {c.name}</CommandItem>)}
          {(products.data?.items ?? []).map((p) => <CommandItem key={p.id} value={`product ${p.name}`} onSelect={() => onNavigate(`/projects/${projectId}/products/${p.id}`)} hint="product"><Gem /> {p.name}</CommandItem>)}
          {(talent.data?.items ?? []).map((t) => <CommandItem key={t.id} value={`talent ${t.name}`} onSelect={() => onNavigate(`/projects/${projectId}/talent/${t.id}`)} hint="talent"><Users /> {t.name}</CommandItem>)}
        </CommandGroup>
      ) : null}
      <CommandGroup heading="Projects">
        {(projects.data?.items ?? []).map((p) => <CommandItem key={p.id} value={`project ${p.name} ${p.clientName ?? ""}`} onSelect={() => onNavigate(`/projects/${p.id}`)} hint={p.clientName ?? undefined}><FolderOpen /> {p.name}</CommandItem>)}
      </CommandGroup>
    </CommandDialog>
  );
}
