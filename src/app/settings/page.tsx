"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/input";
import { SectionTitle } from "@/components/ui/empty";
import { useGet, useAction } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { useCapabilities } from "@/components/studio/widgets";
import { RefreshCw, Stethoscope } from "lucide-react";

export default function SettingsPage() {
  const settings = useGet<{ settings: Record<string, unknown>; env: { dataDir: string; hasCloudKey: boolean; hasAnthropicKey: boolean; cliPath: string | null; directorModel: string; qaModel: string; mock: boolean; concurrency: Record<string, number>; capDefault: number } }>("/api/settings");
  const caps = useCapabilities();
  const health = useGet<{ lanes: { cloud: { available: boolean; reason?: string }; cli: { available: boolean; state: string; path?: string | null; reason?: string }; claude: { available: boolean; reason?: string } }; integrity: { result: string; at: number } | null; ffmpeg: string }>("/api/health");
  const save = useAction((v: Record<string, unknown>) => api.put("/api/settings", v), { invalidate: ["/api/settings", "/api/capabilities"], success: "Saved" });
  const probe = useAction(() => api.post("/api/settings/probe"), { invalidate: ["/api/jobs"], success: "Probe queued (see Jobs)" });
  const refresh = useAction(() => api.get("/api/capabilities?refresh=1"), { invalidate: ["/api/capabilities", "/api/health"], success: "Lane status refreshed" });
  const s = settings.data?.settings ?? {};
  const overrides = (s.capability_overrides as Record<string, string> | undefined) ?? {};
  const lanes = health.data?.lanes;
  return (
    <div className="mx-auto max-w-[1000px] px-8 py-8 space-y-10">
      <h1 className="font-display text-[32px] leading-none">Settings</h1>
      <section>
        <SectionTitle right={<><Button size="sm" onClick={() => refresh.mutate()}><RefreshCw /> Refresh</Button><Button size="sm" onClick={() => probe.mutate()}><Stethoscope /> Run probe</Button></>}>Providers</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          <LaneCard title="Higgsfield Cloud API" ok={!!lanes?.cloud.available} detail={lanes?.cloud.available ? "Key present (.env.local)" : lanes?.cloud.reason} />
          <LaneCard title="Higgsfield CLI" ok={!!lanes?.cli.available} detail={lanes?.cli.available ? `Logged in · ${lanes.cli.path}` : lanes?.cli.reason ?? lanes?.cli.state} />
          <LaneCard title="Claude" ok={!!lanes?.claude.available} detail={lanes?.claude.available ? `${settings.data?.env.directorModel} / ${settings.data?.env.qaModel}` : lanes?.claude.reason} />
        </div>
        <p className="mt-2 text-[12px] text-fg-2">Keys live in <code className="font-mono">.env.local</code> and never reach the browser. Data folder: <code className="font-mono">{settings.data?.env.dataDir}</code> · ffmpeg: <code className="font-mono">{health.data?.ffmpeg}</code>{health.data?.integrity ? ` · DB integrity: ${health.data.integrity.result}` : ""}{settings.data?.env.mock ? " · MOCK_PROVIDERS=1" : ""}</p>
      </section>
      <section>
        <SectionTitle>Budget</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Daily spend cap (USD)" hint={`Default ${settings.data?.env.capDefault}`}><Input type="number" defaultValue={(s.daily_cap_usd as number | undefined) ?? settings.data?.env.capDefault ?? 50} onBlur={(e) => save.mutate({ daily_cap_usd: Number(e.target.value) })} /></Field>
          <Field label="Auto-flag below score"><Input type="number" step="0.5" defaultValue={(s.qa_flag_below as number | undefined) ?? 5} onBlur={(e) => save.mutate({ qa_flag_below: Number(e.target.value) })} /></Field>
          <Field label="Highlight at or above"><Input type="number" step="0.5" defaultValue={(s.qa_highlight_at as number | undefined) ?? 8} onBlur={(e) => save.mutate({ qa_highlight_at: Number(e.target.value) })} /></Field>
        </div>
      </section>
      <section>
        <SectionTitle>Model routing</SectionTitle>
        <p className="mb-3 text-[12px] text-fg-2">Each capability resolves to the first available implementation. Override the preferred one per capability; unavailable lanes fall through automatically.</p>
        <div className="divide-y divide-line rounded-[var(--radius-md)] hairline">
          {(caps.data?.capabilities ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2">
              <div className="w-56 text-[13px] text-fg-0">{c.label}<div className="text-[11px] text-fg-3 font-mono">{c.id}</div></div>
              <Select className="max-w-[360px]" value={overrides[c.id] ?? ""} onChange={(e) => save.mutate({ capability_overrides: { ...overrides, [c.id]: e.target.value || undefined } })}>
                <option value="">Auto ({c.resolved.unavailable ? "unavailable" : c.resolved.impl.label})</option>
                {[c.resolved.impl, ...c.resolved.alternates].filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
              </Select>
              {c.resolved.unavailable ? <Badge tone="danger">unavailable</Badge> : c.resolved.impl.degraded ? <Badge tone="warn" title={c.resolved.impl.degraded}>fallback</Badge> : <Badge tone="ok">ready</Badge>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LaneCard({ title, ok, detail }: { title: string; ok: boolean; detail?: string | null }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-bg-1 p-4 hairline">
      <div className="flex items-center justify-between"><span className="text-[13px] font-medium text-fg-0">{title}</span><Badge tone={ok ? "ok" : "warn"}>{ok ? "ready" : "not ready"}</Badge></div>
      <div className="mt-2 text-[12px] text-fg-2 break-all">{detail ?? "—"}</div>
    </div>
  );
}
