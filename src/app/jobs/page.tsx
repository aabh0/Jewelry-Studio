"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useGet } from "@/hooks/use-api";
import { JobRow, type JobLite } from "@/components/studio/widgets";
import { EmptyState } from "@/components/ui/empty";
import { Chip } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatUsd } from "@/lib/money";

const FILTERS = [["active", "queued,running"], ["failed", "failed"], ["done", "succeeded"], ["all", ""]] as const;

export default function JobsPage() {
  const sp = useSearchParams();
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number][0]>("active");
  const status = FILTERS.find((f) => f[0] === filter)![1];
  const jobs = useGet<{ items: JobLite[] }>(`/api/jobs?limit=200${status ? `&status=${status}` : ""}`, { refetchInterval: 3000 });
  const selected = sp.get("job");
  const ledger = useGet<{ todayUsd: number; monthUsd: number; cap: number; creditsToday: number }>("/api/ledger/summary", { refetchInterval: 10_000 });
  return (
    <div className="mx-auto max-w-[1100px] px-8 py-8 space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-[32px] leading-none">Jobs</h1>
        <div className="flex-1" />
        <span className="text-[12px] text-fg-2 tabular">Today {formatUsd(ledger.data?.todayUsd)} of {formatUsd(ledger.data?.cap)} cap · month {formatUsd(ledger.data?.monthUsd)}{ledger.data?.creditsToday ? ` · ${Math.round(ledger.data.creditsToday)} credits` : ""}</span>
      </div>
      <div className="flex gap-1.5">{FILTERS.map(([k]) => <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{k}</Chip>)}</div>
      {jobs.data && jobs.data.items.length === 0 ? <EmptyState title="Quiet" body="No jobs match this filter." /> : <div className="space-y-1.5">{(jobs.data?.items ?? []).map((j) => <JobRow key={j.id} job={j} />)}</div>}
      <JobDetail id={selected} />
    </div>
  );
}

function JobDetail({ id }: { id: string | null }) {
  const [open, setOpen] = React.useState(!!id);
  React.useEffect(() => setOpen(!!id), [id]);
  const job = useGet<{ id: string; type: string; status: string; label: string | null; error: string | null; payload: unknown; result: unknown; events: { id: number; ts: number; kind: string; data: Record<string, unknown> }[]; children: JobLite[] }>(id && open ? `/api/jobs/${id}` : null, { refetchInterval: 2000 });
  if (!id) return null;
  const j = job.data;
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) history.replaceState(null, "", "/jobs"); }}>
      <DialogContent wide title={j?.label ?? j?.type ?? "Job"} description={j ? `${j.type} · ${j.status}` : undefined}>
        {!j ? null : (
          <div className="space-y-4 text-[12px]">
            {j.error ? <div className="rounded-[var(--radius-md)] bg-danger/10 p-3 text-danger">{j.error}</div> : null}
            <div className="grid grid-cols-2 gap-3">
              <div><div className="mb-1 text-fg-2">Payload</div><pre className="max-h-40 overflow-auto rounded-[var(--radius-sm)] bg-bg-2 p-2 font-mono text-[11px]">{JSON.stringify(j.payload, null, 2)}</pre></div>
              <div><div className="mb-1 text-fg-2">Result</div><pre className="max-h-40 overflow-auto rounded-[var(--radius-sm)] bg-bg-2 p-2 font-mono text-[11px]">{JSON.stringify(j.result, null, 2)}</pre></div>
            </div>
            {j.children.length ? <div><div className="mb-1 text-fg-2">Children</div><div className="space-y-1">{j.children.map((c) => <JobRow key={c.id} job={c} compact />)}</div></div> : null}
            <div><div className="mb-1 text-fg-2">Log</div><div className="max-h-64 overflow-auto rounded-[var(--radius-sm)] bg-bg-2 p-2 font-mono text-[11px] space-y-0.5">{j.events.map((e) => <div key={e.id} className="flex gap-2"><span className="text-fg-3 shrink-0">{new Date(e.ts).toLocaleTimeString()}</span><Badge className="shrink-0">{e.kind}</Badge><span className="text-fg-1 break-all">{e.kind === "progress" ? `${Math.round(Number(e.data.pct ?? 0))}% ${String(e.data.message ?? "")}` : e.kind === "log" ? String(e.data.line ?? "") : JSON.stringify(e.data)}</span></div>)}</div></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
