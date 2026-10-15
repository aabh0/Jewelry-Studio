"use client";
import * as React from "react";
import Link from "next/link";
import { Loader2, XCircle, RotateCcw, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/controls";
import { Tooltip } from "@/components/ui/tooltip";
import { useGet, useAction } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatUsd, formatCredits } from "@/lib/money";
import { cn } from "@/lib/cn";

export function EstimateBadge({ usd, credits, note, large }: { usd?: number | null; credits?: number | null; note?: string; large?: boolean }) {
  const text = usd !== null && usd !== undefined ? formatUsd(usd) : credits !== null && credits !== undefined ? formatCredits(credits) : note ?? "est. at run";
  return <span className={cn("tabular rounded-full bg-bg-3 text-fg-1", large ? "px-3 py-1 text-[14px] font-medium text-fg-0" : "px-2 py-0.5 text-[11px]")} title={note}>{text}</span>;
}

export interface CapabilityInfo { id: string; label: string; resolved: { impl: { id: string; lane: string; model: string; label: string; degraded?: string }; unavailable: boolean; reason?: string; alternates: { id: string; label: string; lane: string }[] } }

export function useCapabilities() {
  return useGet<{ capabilities: CapabilityInfo[]; lanes: { cloud: { available: boolean }; cli: { available: boolean; state: string; reason?: string }; claude: { available: boolean } } }>("/api/capabilities", { staleTime: 30_000 });
}

export function CapabilityBadge({ id }: { id: string }) {
  const caps = useCapabilities();
  const c = caps.data?.capabilities.find((x) => x.id === id);
  if (!c) return <Badge>…</Badge>;
  if (c.resolved.unavailable) return <Tooltip content={c.resolved.reason}><Badge tone="danger">{c.label}: unavailable</Badge></Tooltip>;
  return (
    <Tooltip content={c.resolved.impl.degraded ?? `${c.resolved.impl.label} · ${c.resolved.impl.lane}`}>
      <Badge tone={c.resolved.impl.degraded ? "warn" : "neutral"}>{c.resolved.impl.label}</Badge>
    </Tooltip>
  );
}

export interface JobLite { id: string; type: string; status: string; label: string | null; progressPct: number | null; progressMessage: string | null; error: string | null; createdAt: number; projectId: string | null; campaignId: string | null; parentId: string | null }

export function statusTone(s: string): "neutral" | "accent" | "ok" | "warn" | "danger" | "info" {
  return s === "succeeded" ? "ok" : s === "failed" ? "danger" : s === "running" ? "accent" : s === "cancelled" ? "warn" : "neutral";
}

export function JobRow({ job, compact }: { job: JobLite; compact?: boolean }) {
  const cancel = useAction((id: string) => api.post(`/api/jobs/${id}/cancel`), { invalidate: ["/api/jobs"] });
  const retry = useAction((id: string) => api.post(`/api/jobs/${id}/retry`), { invalidate: ["/api/jobs"], success: "Job requeued" });
  const Icon = job.status === "running" ? Loader2 : job.status === "succeeded" ? CheckCircle2 : job.status === "failed" ? AlertCircle : job.status === "cancelled" ? XCircle : Clock;
  return (
    <div className={cn("flex items-center gap-3 rounded-[var(--radius-md)] bg-bg-1 px-3 hairline", compact ? "py-2" : "py-3")}>
      <Icon className={cn("size-4 shrink-0", job.status === "running" && "animate-spin text-accent", job.status === "succeeded" && "text-ok", job.status === "failed" && "text-danger", job.status === "queued" && "text-fg-2")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/jobs?job=${job.id}`} className="truncate text-[13px] text-fg-0 hover:underline">{job.label ?? job.type}</Link>
          <span className="text-[11px] text-fg-3">{job.type}</span>
        </div>
        {job.status === "running" ? <div className="mt-1.5 flex items-center gap-2"><Progress value={job.progressPct} className="max-w-[240px]" /><span className="text-[11px] text-fg-2 truncate">{job.progressMessage}</span></div> : null}
        {job.error && job.status === "failed" ? <div className="mt-1 text-[12px] text-danger truncate" title={job.error}>{job.error}</div> : null}
      </div>
      <Badge tone={statusTone(job.status)}>{job.status}</Badge>
      {job.status === "running" || job.status === "queued" ? <Button size="icon-sm" variant="ghost" onClick={() => cancel.mutate(job.id)} aria-label="Cancel"><XCircle /></Button> : null}
      {job.status === "failed" || job.status === "cancelled" ? <Button size="icon-sm" variant="ghost" onClick={() => retry.mutate(job.id)} aria-label="Retry"><RotateCcw /></Button> : null}
    </div>
  );
}

export function RunningJobs({ projectId, campaignId, limit = 6 }: { projectId?: string; campaignId?: string; limit?: number }) {
  const q = useGet<{ items: JobLite[] }>(`/api/jobs?status=queued,running${projectId ? `&project_id=${projectId}` : ""}&limit=50`, { refetchInterval: 4000 });
  const items = (q.data?.items ?? []).filter((j) => !campaignId || j.campaignId === campaignId).slice(0, limit);
  if (items.length === 0) return null;
  return <div className="space-y-1.5">{items.map((j) => <JobRow key={j.id} job={j} compact />)}</div>;
}

export function ScoreRing({ score, size = 36 }: { score: number | null | undefined; size?: number }) {
  const v = score ?? null;
  const pct = v === null ? 0 : v / 10;
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const tone = v === null ? "var(--fg-3)" : v >= 8 ? "var(--ok)" : v >= 5 ? "var(--warn)" : "var(--danger)";
  return (
    <svg width={size} height={size} className="shrink-0" aria-label={v === null ? "Not scored" : `Score ${v}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={3} fill="rgba(0,0,0,0.45)" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={3} fill="none" strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.32} fill="white" className="tabular font-medium">{v === null ? "–" : v.toFixed(1)}</text>
    </svg>
  );
}
