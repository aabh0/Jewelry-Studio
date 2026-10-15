"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, ListChecks, Clapperboard, Eye, Film, Download, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { formatUsd } from "@/lib/money";
import { STATUS_LABEL } from "./project-cards";
import type { CampaignView } from "@/server/campaigns";

export type Campaign = CampaignView;

export function campaignSteps(c: Campaign) {
  const base = `/projects/${c.projectId}/campaigns/${c.id}`;
  const approved = c.shots.filter((s) => s.approved).length;
  const candidates = c.shots.reduce((n, s) => n + s.stats.reduce((m, x) => m + x.candidates, 0), 0);
  const picked = c.shots.filter((s) => (c.kind === "video" ? s.clipAssetId : s.selectedAssetId)).length;
  const steps = [
    { id: "brief", label: "Brief", href: base, icon: FileText, done: !!c.brief.goal && c.productIds.length > 0 },
    ...(c.kind === "video" ? [{ id: "storyboard", label: "Storyboard", href: `${base}/storyboard`, icon: Clapperboard, done: !!c.storyboard }] : []),
    { id: "shots", label: c.kind === "video" ? "Keyframes" : "Shots", href: `${base}/shots`, icon: ListChecks, done: approved > 0, hint: c.shots.length ? `${approved}/${c.shots.length} approved` : undefined },
    { id: "review", label: "Review", href: `${base}/review`, icon: Eye, done: picked > 0, hint: candidates ? `${candidates} candidates` : undefined },
    ...(c.kind === "video" ? [{ id: "assemble", label: "Assemble", href: `${base}/assemble`, icon: Film, done: c.status === "exported" }] : []),
    { id: "exports", label: "Exports", href: `${base}/exports`, icon: Download, done: c.status === "exported" },
  ];
  return steps;
}

export function CampaignHeader({ c, right }: { c: Campaign; right?: React.ReactNode }) {
  const pathname = usePathname();
  const steps = campaignSteps(c);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-[12px] uppercase tracking-wide text-fg-2">{c.kind === "video" ? "Video campaign" : "Stills campaign"}</div>
          <h1 className="mt-1 font-display text-[36px] leading-none truncate">{c.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-[12px] text-fg-2 tabular"><Badge tone={c.status === "review" ? "accent" : c.status === "generating" ? "info" : c.status === "exported" ? "ok" : "neutral"}>{STATUS_LABEL[c.status] ?? c.status}</Badge><span>{formatUsd(c.spendUsd)} spent</span>{c.settings.budget_cap_usd ? <span>· cap {formatUsd(c.settings.budget_cap_usd)}</span> : null}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">{right}</div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto rounded-full bg-bg-1 hairline p-1 w-fit max-w-full">
        {steps.map((s, i) => {
          const active = s.href === pathname;
          return (
            <Link key={s.id} href={s.href} className={cn("flex items-center gap-2 rounded-full px-3 h-8 text-[12.5px] whitespace-nowrap transition-colors", active ? "bg-bg-3 text-fg-0" : "text-fg-1 hover:text-fg-0 hover:bg-bg-2")}>
              <span className={cn("flex size-4 items-center justify-center rounded-full text-[10px] tabular", s.done ? "bg-ok text-black" : "bg-bg-3 text-fg-2")}>{s.done ? <Check className="size-3" /> : i + 1}</span>
              {s.label}
              {s.hint ? <span className="text-[11px] text-fg-3">{s.hint}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
