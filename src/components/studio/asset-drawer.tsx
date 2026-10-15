"use client";
import * as React from "react";
import { Dialog } from "radix-ui";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Drawer } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent, Separator } from "@/components/ui/controls";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useGet, useAction } from "@/hooks/use-api";
import { api, mediaUrl } from "@/lib/api";
import { VideoPlayer } from "./video-player";
import { AssetThumb } from "./asset-thumb";
import { LightingEditor } from "./lighting-editor";
import { MaskBrush } from "./mask-brush";
import { CapabilityBadge } from "./widgets";
import { lightingFromPreset, type LightingSpec } from "@/domain/lighting";
import { CHANNELS } from "@/domain/delivery";
import { Wand2, Sun, Brush, Expand, Scissors, ArrowUpRight, Crop, SlidersHorizontal, Download, FolderOpen, ExternalLink, Film, Replace, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { formatUsd } from "@/lib/money";

export interface AssetFull { id: string; projectId: string | null; kind: string; role: string; pathRel: string; mime: string; bytes: number; width: number | null; height: number | null; durationMs: number | null; version: number; parentAssetId: string | null; metaJson: string | null; note: string | null; originalName: string | null; createdAt: number; tags?: string[] }

type Op = "refine" | "relight" | "inpaint" | "outpaint" | "cutout" | "upscale" | "crop" | "adjust" | "reframe" | "extend" | "object_swap" | "video_upscale";

export function AssetDrawer({ assetId, onOpenChange, productId, campaignId, qa, promptText, onExported }: { assetId: string | null; onOpenChange: (o: boolean) => void; productId?: string; campaignId?: string; qa?: Record<string, unknown> | null; promptText?: string; onExported?: () => void }) {
  const asset = useGet<AssetFull>(assetId ? `/api/assets/${assetId}` : null);
  const lineage = useGet<{ items: AssetFull[] }>(assetId ? `/api/assets/${assetId}/lineage` : null);
  const [op, setOp] = React.useState<Op | null>(null);
  const [instruction, setInstruction] = React.useState("");
  const [lighting, setLighting] = React.useState<LightingSpec>(lightingFromPreset("clean_studio"));
  const [aspect, setAspect] = React.useState("16:9");
  const [adj, setAdj] = React.useState({ brightness: 1, saturation: 1, contrast: 1, warmth: 0 });
  const [maskBlob, setMaskBlob] = React.useState<Blob | null>(null);
  const [exportChannels, setExportChannels] = React.useState<string[]>(["ig_feed_45"]);
  const a = asset.data;
  const meta = a?.metaJson ? (JSON.parse(a.metaJson) as Record<string, unknown>) : {};
  const runEdit = useAction(async (args: { op: Op; params: Record<string, unknown>; maskId?: string }) => api.post<{ job_id: string }>("/api/edits", { op: args.op, source_asset_id: assetId, params: args.params, mask_asset_id: args.maskId }), { invalidate: ["/api/jobs", "/api/assets"], success: "Edit queued", onSuccess: () => { setOp(null); setInstruction(""); } });
  const exportNow = useAction(async () => api.post(`/api/campaigns/${campaignId}/exports`, { channel_ids: exportChannels, asset_ids: [assetId] }), { invalidate: ["/api/campaigns", "/api/jobs"], success: "Export queued", onSuccess: () => onExported?.() });
  const uploadMask = async (): Promise<string | undefined> => {
    if (!maskBlob || !a?.projectId) return undefined;
    const fd = new FormData();
    fd.append("role", "mask");
    fd.append("files", new File([maskBlob], `mask-${a.id}.png`, { type: "image/png" }));
    const r = await api.post<{ items: { id: string }[] }>(`/api/projects/${a.projectId}/assets`, fd);
    return r.items[0]?.id;
  };
  const submit = async () => {
    if (!op || !a) return;
    const base: Record<string, unknown> = { product_id: productId };
    if (op === "refine") return runEdit.mutate({ op, params: { ...base, instruction } });
    if (op === "relight") return runEdit.mutate({ op, params: { ...base, lighting } });
    if (op === "inpaint") { const maskId = await uploadMask(); if (!maskId) return toast.error("Paint a mask first"); return runEdit.mutate({ op, params: { ...base, instruction }, maskId }); }
    if (op === "outpaint") return runEdit.mutate({ op, params: { ...base, aspect, scene_hint: instruction } });
    if (op === "adjust") return runEdit.mutate({ op, params: { adjust: adj } });
    if (op === "reframe") return runEdit.mutate({ op, params: { aspect } });
    if (op === "extend") return runEdit.mutate({ op, params: { ...base, prompt: instruction || undefined, duration_s: 8 } });
    if (op === "object_swap") return runEdit.mutate({ op, params: { ...base, instruction, ref_asset_ids: productRefIds } });
    return runEdit.mutate({ op, params: base });
  };
  const product = useGet<{ refs: { assetId: string; role: string; approved: number }[] }>(productId ? `/api/products/${productId}` : null);
  const productRefIds = (product.data?.refs ?? []).filter((r) => r.approved).slice(0, 4).map((r) => r.assetId);
  const isVideo = a?.kind === "video";
  const ops: { id: Op; label: string; icon: React.ElementType; cap: string; video?: boolean; image?: boolean }[] = [
    { id: "refine", label: "Refine", icon: Wand2, cap: "image.edit.refine", image: true },
    { id: "relight", label: "Relight", icon: Sun, cap: "image.edit.relight", image: true },
    { id: "inpaint", label: "Inpaint", icon: Brush, cap: "image.edit.inpaint", image: true },
    { id: "outpaint", label: "Outpaint", icon: Expand, cap: "image.edit.outpaint", image: true },
    { id: "cutout", label: "Clean plate", icon: Scissors, cap: "image.clean_plate", image: true },
    { id: "upscale", label: "Upscale", icon: ArrowUpRight, cap: "image.upscale", image: true },
    { id: "crop", label: "Crop", icon: Crop, cap: "", image: true },
    { id: "adjust", label: "Adjust", icon: SlidersHorizontal, cap: "", image: true },
    { id: "reframe", label: "Reframe", icon: Crop, cap: "video.edit.reframe", video: true },
    { id: "extend", label: "Extend", icon: Film, cap: "video.edit.extend", video: true },
    { id: "object_swap", label: "Object swap", icon: Replace, cap: "video.edit.object_swap", video: true },
    { id: "video_upscale", label: "Upscale", icon: ArrowUpRight, cap: "video.upscale", video: true },
  ];
  return (
    <Dialog.Root open={!!assetId} onOpenChange={onOpenChange}>
      <Drawer title={a ? (a.originalName ?? `${a.role} · v${a.version}`) : "Asset"} width={560}>
        {!a ? <div className="p-5"><div className="skeleton aspect-square" /></div> : (
          <div className="flex flex-col">
            <div className="bg-black">
              {isVideo ? <VideoPlayer pathRel={a.pathRel} className="max-h-[48vh]" autoPlay /> : (
                <TransformWrapper minScale={0.5} maxScale={4} centerOnInit wheel={{ step: 0.15 }} doubleClick={{ mode: "toggle", step: 2 }}>
                  <TransformComponent wrapperStyle={{ width: "100%", height: "48vh" }} contentStyle={{ width: "100%", height: "100%" }}>
                    <img src={mediaUrl(a.pathRel)} alt="" className="mx-auto max-h-[48vh] object-contain" draggable={false} />
                  </TransformComponent>
                </TransformWrapper>
              )}
            </div>
            <div className="flex items-center gap-2 px-5 py-2 text-[11px] text-fg-2 border-b border-line">
              <span>{a.width}×{a.height}</span>{a.durationMs ? <span>· {(a.durationMs / 1000).toFixed(1)}s</span> : null}<span>· {(a.bytes / 1024 / 1024).toFixed(1)} MB</span><span>· v{a.version}</span>
              {typeof meta.model === "string" ? <Badge className="ml-auto">{String(meta.model)}</Badge> : null}
              <a href={mediaUrl(a.pathRel)} target="_blank" rel="noreferrer" className="ml-1 text-fg-1 hover:text-fg-0" title="Open file"><ExternalLink className="size-3.5" /></a>
            </div>
            <Tabs defaultValue="actions" className="px-5 py-3">
              <TabsList><TabsTrigger value="actions">Edit</TabsTrigger><TabsTrigger value="qa">QA</TabsTrigger><TabsTrigger value="prompt">Prompt</TabsTrigger><TabsTrigger value="versions">Versions</TabsTrigger>{campaignId ? <TabsTrigger value="export">Export</TabsTrigger> : null}</TabsList>
              <TabsContent value="actions" className="pt-3 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {ops.filter((o) => (isVideo ? o.video : o.image)).map((o) => <Button key={o.id} size="sm" variant={op === o.id ? "primary" : "secondary"} onClick={() => setOp(op === o.id ? null : o.id)}><o.icon /> {o.label}</Button>)}
                </div>
                {op ? (
                  <div className="rounded-[var(--radius-md)] bg-bg-2 p-3 space-y-3 rise-in">
                    <div className="flex items-center justify-between"><span className="text-[13px] font-medium text-fg-0">{ops.find((o) => o.id === op)?.label}</span>{ops.find((o) => o.id === op)?.cap ? <CapabilityBadge id={ops.find((o) => o.id === op)!.cap} /> : <Badge>local</Badge>}</div>
                    {(op === "refine" || op === "inpaint" || op === "extend" || op === "object_swap") ? <Field label={op === "refine" ? "Only change…" : op === "inpaint" ? "Inside the mask…" : op === "extend" ? "Continue with… (optional)" : "Swap instruction"}><Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={op === "refine" ? "warm the gold slightly; keep everything else identical" : op === "inpaint" ? "replace the prong with a clean four-prong setting" : op === "object_swap" ? "replace the ring with the referenced product" : ""} /></Field> : null}
                    {op === "inpaint" && a.width && a.height ? <MaskBrush src={mediaUrl(a.pathRel)} width={a.width} height={a.height} onExport={(b) => { setMaskBlob(b); toast.success("Mask ready"); }} /> : null}
                    {op === "relight" ? <LightingEditor value={lighting} onChange={setLighting} compact /> : null}
                    {(op === "outpaint" || op === "reframe") ? <Field label="Target aspect"><Select value={aspect} onChange={(e) => setAspect(e.target.value)}>{["16:9", "9:16", "4:5", "1:1", "3:4", "2:3", "21:9"].map((x) => <option key={x} value={x}>{x}</option>)}</Select></Field> : null}
                    {op === "outpaint" ? <Field label="Scene hint (optional)"><Input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="continue the marble surface and soft backdrop" /></Field> : null}
                    {op === "adjust" ? <div className="grid grid-cols-2 gap-2">{(["brightness", "saturation", "contrast", "warmth"] as const).map((k) => <Field key={k} label={`${k} (${adj[k]})`}><input type="range" min={k === "warmth" ? -1 : 0.5} max={k === "warmth" ? 1 : 1.5} step={0.02} value={adj[k]} onChange={(e) => setAdj({ ...adj, [k]: Number(e.target.value) })} className="w-full accent-[var(--accent)]" /></Field>)}</div> : null}
                    {op === "crop" ? <p className="text-[12px] text-fg-2">Crop uses the center {`4:5`} region for now; use Outpaint or Reframe for aspect changes.</p> : null}
                    <div className="flex justify-end"><Button variant="primary" size="sm" onClick={() => void submit()} disabled={runEdit.isPending}>Run {ops.find((o) => o.id === op)?.label.toLowerCase()}</Button></div>
                  </div>
                ) : null}
                <Separator />
                <Field label="Note"><Textarea defaultValue={a.note ?? ""} onBlur={(e) => void api.patch(`/api/assets/${a.id}`, { note: e.target.value })} placeholder="Private note" /></Field>
              </TabsContent>
              <TabsContent value="qa" className="pt-3"><QaPanel qa={qa ?? (meta.qa as Record<string, unknown> | undefined) ?? null} /></TabsContent>
              <TabsContent value="prompt" className="pt-3">{promptText ? <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-fg-1 font-sans">{promptText}</pre> : <p className="text-[12px] text-fg-2">No prompt recorded for this asset.</p>}</TabsContent>
              <TabsContent value="versions" className="pt-3">
                <div className="grid grid-cols-3 gap-2">{(lineage.data?.items ?? []).map((l) => <AssetThumb key={l.id} asset={l} w={256} selected={l.id === a.id}><div className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-[10px] text-white">v{l.version} · {l.role}</div></AssetThumb>)}</div>
              </TabsContent>
              {campaignId ? (
                <TabsContent value="export" className="pt-3 space-y-3">
                  <div className="flex flex-wrap gap-1.5">{CHANNELS.filter((c) => c.kind === "both" || c.kind === (isVideo ? "video" : "image")).map((c) => <Button key={c.id} size="sm" variant={exportChannels.includes(c.id) ? "primary" : "secondary"} onClick={() => setExportChannels((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))}>{c.label}</Button>)}</div>
                  <Button variant="primary" onClick={() => exportNow.mutate()} disabled={exportChannels.length === 0 || exportNow.isPending}><Download /> Export {exportChannels.length} channel{exportChannels.length === 1 ? "" : "s"}</Button>
                </TabsContent>
              ) : null}
            </Tabs>
          </div>
        )}
      </Drawer>
    </Dialog.Root>
  );
}

export function QaPanel({ qa }: { qa: Record<string, unknown> | null }) {
  if (!qa) return <p className="text-[12px] text-fg-2">Not scored yet.</p>;
  const defects = (qa.defects as { kind: string; where: string; severity: string; fix_prompt: string }[] | undefined) ?? [];
  const n = (k: string) => (typeof qa[k] === "number" ? (qa[k] as number).toFixed(1) : "–");
  return (
    <div className="space-y-3 text-[12px]">
      <div className="grid grid-cols-4 gap-2">
        {[["Overall", "score"], ["Fidelity", "product_fidelity"], ["Brief", "brief_adherence"], ["Technical", "technical"]].map(([l, k]) => <div key={k} className="rounded-[var(--radius-sm)] bg-bg-2 p-2"><div className="text-fg-2">{l}</div><div className="tabular text-[18px] font-medium text-fg-0">{n(k)}</div></div>)}
      </div>
      {typeof qa.identity_consistency === "number" ? <div className="text-fg-1">Identity consistency: <span className="tabular text-fg-0">{(qa.identity_consistency as number).toFixed(1)}</span></div> : null}
      <div className="flex items-center gap-2"><Badge tone={qa.verdict === "pass" ? "ok" : qa.verdict === "retry" ? "danger" : "warn"}>{String(qa.verdict ?? "")}</Badge><span className="text-fg-1">{String(qa.one_line ?? "")}</span></div>
      {defects.length ? <ul className="space-y-1.5">{defects.map((d, i) => <li key={i} className="rounded-[var(--radius-sm)] bg-bg-2 p-2"><div className="flex items-center gap-2"><Badge tone={d.severity === "major" ? "danger" : "warn"}>{d.kind}</Badge><span className="text-fg-1">{d.where}</span></div><div className="mt-1 text-fg-0">Fix: {d.fix_prompt}</div></li>)}</ul> : <p className="text-fg-2">No defects reported.</p>}
      {typeof (qa.local as { metal_hue_delta?: number } | null)?.metal_hue_delta === "number" ? <div className="text-fg-2">Local metal hue delta: {(qa.local as { metal_hue_delta: number }).metal_hue_delta}°</div> : null}
    </div>
  );
}

export function SpendLine({ usd }: { usd: number | null | undefined }) {
  return <span className="tabular text-fg-2">{formatUsd(usd)}</span>;
}

export { FolderOpen, Sparkles };
