"use client";
import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Check, X, Flag, HelpCircle, Columns2, Maximize2, Sparkles, Play, ArrowRight, RotateCcw, MessageSquareText, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/badge";
import { Select, Input } from "@/components/ui/input";
import { Slider, Kbd, Skeleton } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/empty";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { useGet, useAction } from "@/hooks/use-api";
import { useUiState } from "@/hooks/use-ui-state";
import { api } from "@/lib/api";
import { CampaignHeader, type Campaign } from "@/components/studio/campaign-nav";
import { RunningJobs, ScoreRing } from "@/components/studio/widgets";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { AssetDrawer } from "@/components/studio/asset-drawer";
import { CompareDialog } from "@/components/studio/compare-dialog";
import { QA_DEFECT_KINDS, type QAResult } from "@/domain/storyboard";
import { humanize } from "@/domain/taxonomy";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

type Review = "unreviewed" | "approved" | "rejected" | "flagged" | "maybe";
interface Candidate { id: string; shotId: string | null; stage: string; assetId: string; index: number; qa: QAResult | null; qaScore: number | null; review: Review; reviewNote: string | null; createdAt: number; generation: { id: string; lane: string; modelId: string; seed: number | null; estimateUsd: number | null; actualUsd: number | null; promptText: string; capability: string }; asset: { id: string; kind: string; pathRel: string; width: number | null; height: number | null; durationMs: number | null } }
const REVIEWS: { id: Review; label: string; tone: "neutral" | "ok" | "danger" | "warn" | "info" }[] = [{ id: "unreviewed", label: "Unreviewed", tone: "neutral" }, { id: "approved", label: "Approved", tone: "ok" }, { id: "maybe", label: "Maybe", tone: "info" }, { id: "flagged", label: "Flagged", tone: "warn" }, { id: "rejected", label: "Rejected", tone: "danger" }];

export default function ReviewPage() {
  const { id, campaignId } = useParams<{ id: string; campaignId: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const q = useGet<Campaign>(`/api/campaigns/${campaignId}`);
  const c = q.data;
  const isVideo = c?.kind === "video";
  const [ui, setUi, loaded] = useUiState(`review:${campaignId}`, { stage: "", shot: "", review: [] as string[], verdict: [] as string[], minScore: 0, flag: "", sort: "newest" as "score" | "newest" | "oldest", lane: "" });
  React.useEffect(() => { const s = sp.get("shot"); const st = sp.get("stage"); if (s || st) setUi({ ...(s ? { shot: s } : {}), ...(st ? { stage: st } : {}) }); }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const stage = ui.stage || (isVideo ? "keyframes" : "stills");
  const params = new URLSearchParams({ stage, sort: ui.sort, limit: "400" });
  if (ui.shot) params.set("shot_id", ui.shot);
  if (ui.review.length) params.set("review", ui.review.join(","));
  if (ui.verdict.length) params.set("verdict", ui.verdict.join(","));
  if (ui.minScore > 0) params.set("min_score", String(ui.minScore));
  if (ui.flag) params.set("flag", ui.flag);
  if (ui.lane) params.set("lane", ui.lane);
  const cands = useGet<{ items: Candidate[]; total: number }>(loaded && c ? `/api/campaigns/${campaignId}/candidates?${params.toString()}` : null, { refetchInterval: 5000 });
  const allCands = useGet<{ items: Candidate[]; total: number }>(c ? `/api/campaigns/${campaignId}/candidates?stage=${stage}&limit=2000` : null, { refetchInterval: 8000 });
  const items = React.useMemo(() => cands.data?.items ?? [], [cands.data]);
  const [sel, setSel] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [compare, setCompare] = React.useState<[Candidate, Candidate] | null>(null);
  const [critique, setCritique] = React.useState<string | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [note, setNote] = React.useState<Candidate | null>(null);
  React.useEffect(() => { if (items.length && (!sel || !items.some((i) => i.id === sel))) setSel(items[0].id); }, [items, sel]);
  const review = useAction((a: { id: string; review: Review; note?: string }) => api.patch(`/api/candidates/${a.id}`, { review: a.review, note: a.note }), { invalidate: ["/api/campaigns"] });
  const genMore = useAction((a: { shotId: string; variants?: number }) => api.post(`/api/shots/${a.shotId}/generate`, { stage, variants: a.variants }), { invalidate: ["/api/jobs", "/api/campaigns"], success: "More variants queued" });
  const genClips = useAction(() => api.post<{ count: number }>(`/api/campaigns/${campaignId}/generate`, { stage: "clips" }), { invalidate: ["/api/jobs", "/api/campaigns"], success: (r) => `Generating clips for ${r.count} frames`, onSuccess: () => setUi({ stage: "clips" }) });
  const selected = items.find((i) => i.id === sel) ?? null;
  const shotOf = (cd: Candidate | null) => c?.shots.find((s) => s.id === cd?.shotId);
  const pickedId = (cd: Candidate | null) => { const s = shotOf(cd); if (!s) return null; return stage === "keyframes" ? s.keyframeAssetId : stage === "clips" ? s.clipAssetId : s.selectedAssetId; };
  const move = React.useCallback((d: number) => { if (!items.length) return; const i = Math.max(0, items.findIndex((x) => x.id === sel)); const n = items[Math.min(items.length - 1, Math.max(0, i + d))]; setSel(n.id); document.getElementById(`cand-${n.id}`)?.scrollIntoView({ block: "nearest" }); }, [items, sel]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (open || compare || note) return;
      const k = e.key.toLowerCase();
      if (k === "j" || k === "arrowright") { e.preventDefault(); move(1); }
      else if (k === "k" || k === "arrowleft") { e.preventDefault(); move(-1); }
      else if (k === "arrowdown") { e.preventDefault(); move(cols()); }
      else if (k === "arrowup") { e.preventDefault(); move(-cols()); }
      else if (!selected) return;
      else if (k === "a") { review.mutate({ id: selected.id, review: "approved" }); move(1); }
      else if (k === "x") { review.mutate({ id: selected.id, review: "rejected" }); move(1); }
      else if (k === "f") { review.mutate({ id: selected.id, review: "flagged" }); move(1); }
      else if (k === "m") { review.mutate({ id: selected.id, review: "maybe" }); move(1); }
      else if (k === "u") { review.mutate({ id: selected.id, review: "unreviewed" }); }
      else if (k === "z" || k === "enter" || k === " ") { e.preventDefault(); setOpen(selected.id); }
      else if (k === "c") { const pid = pickedId(selected); const other = items.find((x) => x.assetId === pid && x.id !== selected.id) ?? items.find((x) => x.shotId === selected.shotId && x.id !== selected.id); if (other) setCompare([other, selected]); else toast("Nothing to compare with yet"); }
      else if (k === "n") { setNote(selected); }
      else if (k === "g") { if (selected.shotId) genMore.mutate({ shotId: selected.shotId }); }
      else if (k === "w") { setCritique(selected.id); }
      else if (k === "?") { setHelpOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selected, move, open, compare, note, review, genMore]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return <div className="mx-auto max-w-[1600px] px-8 py-8"><Skeleton className="h-12 w-96" /><Skeleton className="mt-6 h-[480px]" /></div>;
  const all = allCands.data?.items ?? [];
  const countFor = (shotId: string | "") => all.filter((x) => !shotId || x.shotId === shotId);
  const stages = isVideo ? [["keyframes", "Keyframes"], ["clips", "Clips"]] : [["stills", "Stills"]];
  const pickedKeyframes = c.shots.filter((s) => s.keyframeAssetId).length;
  const pickedClips = c.shots.filter((s) => s.clipAssetId).length;
  const toggle = (key: "review" | "verdict", v: string) => setUi({ [key]: ui[key].includes(v) ? ui[key].filter((x) => x !== v) : [...ui[key], v] } as never);
  return (
    <div className="mx-auto max-w-[1600px] px-8 py-8 space-y-5">
      <CampaignHeader c={c} right={<>
        <Tooltip content="Keyboard shortcuts" shortcut="?"><Button variant="ghost" size="icon" aria-label="Shortcuts" onClick={() => setHelpOpen(true)}><Keyboard /></Button></Tooltip>
        {isVideo && stage === "keyframes" ? <Button variant="primary" disabled={pickedKeyframes === 0 || genClips.isPending} onClick={() => genClips.mutate()}><Play /> Generate clips ({pickedKeyframes} picked)</Button> : null}
        {isVideo && stage === "clips" ? <Button variant="primary" disabled={pickedClips === 0} onClick={() => router.push(`/projects/${id}/campaigns/${campaignId}/assemble`)}>Assemble ({pickedClips} clips) <ArrowRight /></Button> : null}
        {!isVideo ? <Button variant="primary" disabled={c.shots.every((s) => !s.selectedAssetId)} onClick={() => router.push(`/projects/${id}/campaigns/${campaignId}/exports`)}>Export approved <ArrowRight /></Button> : null}
      </>} />
      <RunningJobs projectId={id} campaignId={campaignId} />
      <div className="grid grid-cols-[250px_1fr] gap-6">
        <aside className="space-y-5">
          {stages.length > 1 ? <div className="flex gap-1 rounded-full bg-bg-1 hairline p-1">{stages.map(([k, label]) => <button key={k} className={cn("flex-1 h-8 rounded-full text-[12.5px] cursor-pointer", stage === k ? "bg-bg-3 text-fg-0" : "text-fg-1 hover:text-fg-0")} onClick={() => setUi({ stage: k, shot: "" })}>{label}</button>)}</div> : null}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-fg-2 mb-2">Shots</div>
            <div className="space-y-0.5">
              <ShotNavRow active={ui.shot === ""} label="All shots" count={countFor("").length} approved={countFor("").filter((x) => x.review === "approved").length} onClick={() => setUi({ shot: "" })} />
              {c.shots.map((s) => { const cs = countFor(s.id); const picked = stage === "keyframes" ? s.keyframeAssetId : stage === "clips" ? s.clipAssetId : s.selectedAssetId; return <ShotNavRow key={s.id} active={ui.shot === s.id} label={s.title} count={cs.length} approved={cs.filter((x) => x.review === "approved").length} picked={!!picked} onClick={() => setUi({ shot: s.id })} />; })}
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wide text-fg-2">Filter</div>
            <div className="flex flex-wrap gap-1">{REVIEWS.map((r) => <Chip key={r.id} active={ui.review.includes(r.id)} onClick={() => toggle("review", r.id)}>{r.label}</Chip>)}</div>
            <div className="flex flex-wrap gap-1">{["pass", "review", "retry"].map((v) => <Chip key={v} active={ui.verdict.includes(v)} onClick={() => toggle("verdict", v)}>QA {v}</Chip>)}</div>
            <div><div className="flex items-center justify-between text-[12px] text-fg-2"><span>Min score</span><span className="tabular text-fg-0">{ui.minScore || "any"}</span></div><Slider min={0} max={10} step={0.5} value={[ui.minScore]} onValueChange={(v) => setUi({ minScore: v[0] ?? 0 })} className="mt-2" /></div>
            <Select value={ui.flag} onChange={(e) => setUi({ flag: e.target.value })}><option value="">Any defect</option>{QA_DEFECT_KINDS.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}</Select>
            <div className="grid grid-cols-2 gap-2">
              <Select value={ui.sort} onChange={(e) => setUi({ sort: e.target.value as "score" })}><option value="newest">Newest</option><option value="score">Best score</option><option value="oldest">Oldest</option></Select>
              <Select value={ui.lane} onChange={(e) => setUi({ lane: e.target.value })}><option value="">Any lane</option><option value="cloud">Cloud</option><option value="cli">CLI</option><option value="mock">Mock</option></Select>
            </div>
            {(ui.review.length || ui.verdict.length || ui.minScore || ui.flag || ui.lane) ? <button className="text-[12px] text-fg-2 hover:text-fg-0 cursor-pointer" onClick={() => setUi({ review: [], verdict: [], minScore: 0, flag: "", lane: "" })}>Clear filters</button> : null}
          </div>
        </aside>
        <main className="min-w-0">
          {cands.isLoading ? <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5]" />)}</div> : items.length === 0 ? (
            <EmptyState title={all.length ? "No candidates match these filters" : "Nothing to review yet"} body={all.length ? "Loosen the filters on the left." : stage === "clips" ? "Pick a keyframe per frame, then generate clips." : "Approve shots and generate; candidates land here with QA scores as they finish."} action={all.length ? <Button variant="ghost" onClick={() => setUi({ review: [], verdict: [], minScore: 0, flag: "", lane: "" })}>Clear filters</Button> : <Button variant="primary" onClick={() => router.push(`/projects/${id}/campaigns/${campaignId}/shots`)}>Go to shots</Button>} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3" data-review-grid>
              {items.map((cd) => <CandidateCard key={cd.id} cd={cd} selected={cd.id === sel} picked={pickedId(cd) === cd.assetId} shotTitle={ui.shot ? undefined : shotOf(cd)?.title} onSelect={() => setSel(cd.id)} onOpen={() => { setSel(cd.id); setOpen(cd.id); }} onReview={(r) => review.mutate({ id: cd.id, review: r })} />)}
            </div>
          )}
          {selected ? (
            <div className="sticky bottom-4 mt-4 flex items-center gap-2 rounded-full bg-bg-1/95 backdrop-blur hairline px-3 py-2 shadow-float w-fit mx-auto">
              <span className="text-[12px] text-fg-2 max-w-[200px] truncate">{shotOf(selected)?.title} · #{selected.index + 1}</span>
              <Tooltip content="Approve" shortcut="A"><Button size="sm" variant="ghost" onClick={() => { review.mutate({ id: selected.id, review: "approved" }); move(1); }}><Check className="text-ok" /> Approve</Button></Tooltip>
              <Tooltip content="Maybe" shortcut="M"><Button size="sm" variant="ghost" onClick={() => { review.mutate({ id: selected.id, review: "maybe" }); move(1); }}><HelpCircle /></Button></Tooltip>
              <Tooltip content="Flag" shortcut="F"><Button size="sm" variant="ghost" onClick={() => { review.mutate({ id: selected.id, review: "flagged" }); move(1); }}><Flag className="text-warn" /></Button></Tooltip>
              <Tooltip content="Reject" shortcut="X"><Button size="sm" variant="ghost" onClick={() => { review.mutate({ id: selected.id, review: "rejected" }); move(1); }}><X className="text-danger" /></Button></Tooltip>
              <span className="w-px h-5 bg-line" />
              <Tooltip content="Compare with the picked one" shortcut="C"><Button size="sm" variant="ghost" onClick={() => { const pid = pickedId(selected); const other = items.find((x) => x.assetId === pid && x.id !== selected.id) ?? items.find((x) => x.shotId === selected.shotId && x.id !== selected.id); if (other) setCompare([other, selected]); else toast("Nothing to compare with yet"); }}><Columns2 /></Button></Tooltip>
              <Tooltip content="Open, zoom, edit" shortcut="Z"><Button size="sm" variant="ghost" onClick={() => setOpen(selected.id)}><Maximize2 /></Button></Tooltip>
              <Tooltip content="Note" shortcut="N"><Button size="sm" variant="ghost" onClick={() => setNote(selected)}><MessageSquareText /></Button></Tooltip>
              <Tooltip content="Ask the director why" shortcut="W"><Button size="sm" variant="ghost" onClick={() => setCritique(selected.id)}><Sparkles /></Button></Tooltip>
              <Tooltip content="Generate more for this shot" shortcut="G"><Button size="sm" variant="ghost" disabled={!selected.shotId} onClick={() => selected.shotId && genMore.mutate({ shotId: selected.shotId })}><RotateCcw /> More</Button></Tooltip>
            </div>
          ) : null}
        </main>
      </div>
      <AssetDrawer assetId={open ? (items.find((i) => i.id === open)?.assetId ?? null) : null} onOpenChange={(o) => { if (!o) setOpen(null); }} productId={shotOf(items.find((i) => i.id === open) ?? null)?.spec.product_ids[0] ?? c.productIds[0]} campaignId={campaignId} qa={(items.find((i) => i.id === open)?.qa as unknown as Record<string, unknown>) ?? null} promptText={items.find((i) => i.id === open)?.generation.promptText} />
      <CompareDialog open={!!compare} onOpenChange={(o) => { if (!o) setCompare(null); }} a={compare ? compare[0].asset : null} b={compare ? compare[1].asset : null} labels={compare ? [`#${compare[0].index + 1} · ${compare[0].qaScore?.toFixed(1) ?? "–"}`, `#${compare[1].index + 1} · ${compare[1].qaScore?.toFixed(1) ?? "–"}`] : undefined} />
      <CritiqueDialog candidateId={critique} onOpenChange={(o) => { if (!o) setCritique(null); }} />
      <NoteDialog cd={note} onOpenChange={(o) => { if (!o) setNote(null); }} onSave={(n) => { if (note) review.mutate({ id: note.id, review: note.review, note: n }); setNote(null); }} />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent title="Review shortcuts">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
            {[["J / →", "Next"], ["K / ←", "Previous"], ["↑ / ↓", "Row up / down"], ["A", "Approve (becomes the pick)"], ["M", "Maybe"], ["F", "Flag"], ["X", "Reject"], ["U", "Mark unreviewed"], ["Z / Enter", "Open: zoom, QA, edit"], ["C", "Compare with the pick"], ["N", "Add a note"], ["W", "Ask the director why"], ["G", "Generate more for this shot"]].map(([k, d]) => <div key={k} className="flex items-center justify-between gap-4"><span className="text-fg-1">{d}</span><Kbd>{k}</Kbd></div>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cols() { const g = document.querySelector("[data-review-grid]"); if (!g) return 4; const st = getComputedStyle(g).gridTemplateColumns; return st.split(" ").length || 4; }

function ShotNavRow({ active, label, count, approved, picked, onClick }: { active: boolean; label: string; count: number; approved: number; picked?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("w-full flex items-center gap-2 rounded-[var(--radius-sm)] px-2 h-8 text-[12.5px] cursor-pointer", active ? "bg-bg-3 text-fg-0" : "text-fg-1 hover:bg-bg-2 hover:text-fg-0")}>
      <span className={cn("size-1.5 rounded-full shrink-0", picked ? "bg-ok" : count ? "bg-fg-3" : "bg-transparent")} />
      <span className="truncate flex-1 text-left">{label}</span>
      <span className="text-[11px] text-fg-3 tabular">{approved ? `${approved}/` : ""}{count}</span>
    </button>
  );
}

function CandidateCard({ cd, selected, picked, shotTitle, onSelect, onOpen, onReview }: { cd: Candidate; selected: boolean; picked: boolean; shotTitle?: string; onSelect: () => void; onOpen: () => void; onReview: (r: Review) => void }) {
  const rv = REVIEWS.find((r) => r.id === cd.review)!;
  const majors = cd.qa?.defects.filter((d) => d.severity === "major") ?? [];
  return (
    <div id={`cand-${cd.id}`} className={cn("group rounded-[var(--radius-md)] bg-bg-1 hairline overflow-hidden transition-shadow", selected && "ring-2 ring-accent", cd.review === "rejected" && "opacity-50")} onClick={onSelect} onDoubleClick={onOpen}>
      <AssetThumb asset={cd.asset} w={768} rounded={false} className="cursor-pointer">
        <div className="absolute left-2 top-2 flex items-center gap-1.5"><ScoreRing score={cd.qaScore} size={34} />{cd.qa?.verdict ? <Badge tone={cd.qa.verdict === "pass" ? "ok" : cd.qa.verdict === "retry" ? "danger" : "warn"}>{cd.qa.verdict}</Badge> : <Badge>QA pending</Badge>}</div>
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">{picked ? <Badge tone="accent">picked</Badge> : null}{cd.review !== "unreviewed" ? <Badge tone={rv.tone}>{rv.label}</Badge> : null}</div>
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/75 to-transparent p-2 pt-8 opacity-0 group-hover:opacity-100 transition-opacity">
          {([["approved", Check, "text-ok"], ["maybe", HelpCircle, ""], ["flagged", Flag, "text-warn"], ["rejected", X, "text-danger"]] as const).map(([r, Icon, cls]) => <button key={r} className="size-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-white/20 cursor-pointer" aria-label={r} onClick={(e) => { e.stopPropagation(); onReview(r); }}><Icon className={cn("size-4", cls)} /></button>)}
          <button className="ml-auto size-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-white/20 cursor-pointer" aria-label="Open" onClick={(e) => { e.stopPropagation(); onOpen(); }}><Maximize2 className="size-4" /></button>
        </div>
      </AssetThumb>
      <div className="p-2.5 space-y-1">
        <div className="flex items-center gap-2 text-[11px] text-fg-3"><span className="truncate">{shotTitle ? `${shotTitle} · ` : ""}#{cd.index + 1}</span><span className="ml-auto shrink-0">{cd.generation.modelId.split("/").pop()}</span></div>
        {cd.qa ? <div className="text-[12px] text-fg-1 line-clamp-2" title={cd.qa.one_line}>{cd.qa.one_line}</div> : <div className="text-[12px] text-fg-3">Awaiting QA…</div>}
        {majors.length ? <div className="flex flex-wrap gap-1">{majors.slice(0, 3).map((d, i) => <Badge key={i} tone="danger">{humanize(d.kind)}</Badge>)}</div> : null}
        {cd.reviewNote ? <div className="text-[11px] text-fg-2 italic truncate">“{cd.reviewNote}”</div> : null}
      </div>
    </div>
  );
}

function CritiqueDialog({ candidateId, onOpenChange }: { candidateId: string | null; onOpenChange: (o: boolean) => void }) {
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [question, setQuestion] = React.useState("");
  const ask = useAction(() => api.post<{ job_id: string }>("/api/director/critique", { candidate_id: candidateId, question: question || undefined }), { onSuccess: (r) => setJobId(r.job_id) });
  const job = useGet<{ status: string; result: { issues: { kind: string; where: string; fix_prompt: string }[]; summary: string } | null; error: string | null }>(jobId ? `/api/jobs/${jobId}` : null, { refetchInterval: (q) => (q.state.data?.status === "succeeded" || q.state.data?.status === "failed" ? false : 1500) });
  React.useEffect(() => { if (!candidateId) { setJobId(null); setQuestion(""); } }, [candidateId]);
  const r = job.data?.result;
  return (
    <Dialog open={!!candidateId} onOpenChange={onOpenChange}>
      <DialogContent title="Ask the director" description="A vision critique of this candidate with a concrete fix prompt per issue. Copy a fix into Refine.">
        {!jobId ? <><Input autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Optional question, e.g. why does the metal look plastic?" /><DialogFooter><Button variant="primary" disabled={ask.isPending} onClick={() => ask.mutate()}><Sparkles /> Critique</Button></DialogFooter></> : job.data?.status === "failed" ? <Badge tone="danger">{job.data.error}</Badge> : !r ? <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-16" /></div> : (
          <div className="space-y-3">
            <p className="text-[13px] text-fg-0 leading-relaxed">{r.summary}</p>
            {r.issues.map((i, k) => <div key={k} className="rounded-[var(--radius-sm)] bg-bg-2 p-3 space-y-1"><div className="flex items-center gap-2 text-[12px]"><Badge tone="warn">{humanize(i.kind)}</Badge><span className="text-fg-2">{i.where}</span></div><div className="text-[12.5px] text-fg-0">{i.fix_prompt}</div><button className="text-[11px] text-accent hover:underline cursor-pointer" onClick={() => { void navigator.clipboard?.writeText(i.fix_prompt); toast.success("Fix prompt copied"); }}>Copy fix prompt</button></div>)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({ cd, onOpenChange, onSave }: { cd: Candidate | null; onOpenChange: (o: boolean) => void; onSave: (n: string) => void }) {
  const [n, setN] = React.useState("");
  React.useEffect(() => setN(cd?.reviewNote ?? ""), [cd]);
  return (
    <Dialog open={!!cd} onOpenChange={onOpenChange}>
      <DialogContent title="Review note">
        <Input autoFocus value={n} onChange={(e) => setN(e.target.value)} placeholder="Why this one, or what to fix" onKeyDown={(e) => { if (e.key === "Enter") onSave(n); }} />
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" onClick={() => onSave(n)}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
