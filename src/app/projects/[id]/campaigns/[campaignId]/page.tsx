"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, ClipboardPaste, Check, Trash2, MoreHorizontal, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/controls";
import { SectionTitle } from "@/components/ui/empty";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { useGet, useAction, useAutosave } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { CampaignHeader, type Campaign } from "@/components/studio/campaign-nav";
import { RunningJobs, useCapabilities } from "@/components/studio/widgets";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { Dropzone } from "@/components/studio/dropzone";
import { AssetDrawer } from "@/components/studio/asset-drawer";
import type { ProductLite, TalentLite } from "@/components/studio/project-cards";
import { CHANNELS } from "@/domain/delivery";
import { OCCASIONS, ASPECTS, humanize } from "@/domain/taxonomy";
import { LIGHTING_PRESETS } from "@/domain/lighting";
import type { CampaignBrief, CampaignSettings } from "@/domain/storyboard";

const TONES = ["warm", "intimate", "editorial", "minimal", "luxurious", "playful", "modern", "classic", "romantic", "bold", "quiet luxury", "natural"];
const REF_ROLES = ["style", "mood", "lighting", "composition", "location", "talent_look"];

export default function CampaignHub() {
  const { id, campaignId } = useParams<{ id: string; campaignId: string }>();
  const router = useRouter();
  const q = useGet<Campaign>(`/api/campaigns/${campaignId}`);
  const products = useGet<{ items: ProductLite[] }>(`/api/projects/${id}/products`);
  const talent = useGet<{ items: TalentLite[] }>(`/api/projects/${id}/talent`);
  const caps = useCapabilities();
  const [brief, setBrief] = React.useState<CampaignBrief | null>(null);
  const [settings, setSettings] = React.useState<CampaignSettings | null>(null);
  const [name, setName] = React.useState("");
  const [paste, setPaste] = React.useState(false);
  const [open, setOpen] = React.useState<string | null>(null);
  const c = q.data;
  React.useEffect(() => { if (c && !brief) { setBrief(c.brief); setSettings(c.settings); setName(c.name); } }, [c, brief]);
  const parseRef = React.useRef<string | null>(null);
  React.useEffect(() => { if (c && parseRef.current !== null && c.brief.goal !== parseRef.current) { setBrief(c.brief); parseRef.current = null; } }, [c]);
  const { save } = useAutosave<{ name: string; brief: CampaignBrief; settings: Partial<CampaignSettings> }>((patch) => api.patch(`/api/campaigns/${campaignId}`, patch).then(() => undefined));
  const updateBrief = (patch: Partial<CampaignBrief>) => { if (!brief) return; const next = { ...brief, ...patch }; setBrief(next); save({ brief: next }); };
  const updateSettings = (patch: Partial<CampaignSettings>) => { if (!settings) return; const next = { ...settings, ...patch }; setSettings(next); save({ settings: patch }); };
  const patchCampaign = useAction((p: Record<string, unknown>) => api.patch(`/api/campaigns/${campaignId}`, p), { invalidate: ["/api/campaigns", "/api/projects"] });
  const parse = useAction((text: string) => { parseRef.current = brief?.goal ?? ""; return api.post("/api/director/brief-parse", { campaign_id: campaignId, text }); }, { invalidate: ["/api/jobs"], success: "Director is reading the brief", onSuccess: () => setPaste(false) });
  const archive = useAction(() => api.del(`/api/campaigns/${campaignId}`), { invalidate: ["/api/projects", "/api/campaigns"], success: "Campaign archived", onSuccess: () => router.push(`/projects/${id}`) });
  if (!c || !brief || !settings) return <div className="mx-auto max-w-[1200px] px-8 py-8"><Skeleton className="h-12 w-96" /><Skeleton className="mt-6 h-[480px]" /></div>;
  const isVideo = c.kind === "video";
  const base = `/projects/${id}/campaigns/${campaignId}`;
  const next = c.shots.length === 0 ? { label: isVideo ? "Write the storyboard" : "Plan the shots", href: isVideo ? `${base}/storyboard` : `${base}/shots` } : c.shots.some((s) => s.stats.length) ? { label: "Review candidates", href: `${base}/review` } : { label: "Approve & generate", href: `${base}/shots` };
  const selTalent = talent.data?.items.find((t) => t.id === c.talent[0]?.talentId);
  const imageImpls = caps.data?.capabilities.find((x) => x.id === "image.generate.product");
  const videoImpls = caps.data?.capabilities.find((x) => x.id === "video.generate.i2v");
  const toggleList = (key: "tone" | "must_include" | "must_avoid" | "channels", v: string) => updateBrief({ [key]: brief[key].includes(v) ? brief[key].filter((x) => x !== v) : [...brief[key], v] } as Partial<CampaignBrief>);
  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8 space-y-8">
      <CampaignHeader c={c} right={<>
        <Button variant="primary" disabled={c.productIds.length === 0} onClick={() => router.push(next.href)}>{next.label} <ArrowRight /></Button>
        <Menu>
          <MenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More"><MoreHorizontal /></Button></MenuTrigger>
          <MenuContent><MenuItem danger onSelect={() => { if (confirm("Archive this campaign? Assets stay in the library.")) archive.mutate(); }}><Archive /> Archive campaign</MenuItem></MenuContent>
        </Menu>
      </>} />

      <RunningJobs projectId={id} campaignId={campaignId} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-8">
          <section className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-6 space-y-5">
            <SectionTitle right={<Button size="sm" variant="ghost" onClick={() => setPaste(true)}><ClipboardPaste /> Paste a client brief</Button>}>Brief</SectionTitle>
            <Field label="Campaign name"><Input value={name} onChange={(e) => { setName(e.target.value); save({ name: e.target.value }); }} /></Field>
            <Field label="Goal"><Textarea rows={3} value={brief.goal} onChange={(e) => updateBrief({ goal: e.target.value })} placeholder="What this campaign must achieve, in a sentence or two." /></Field>
            <Field label="Tone"><div className="flex flex-wrap gap-1.5">{Array.from(new Set([...TONES, ...brief.tone])).map((t) => <Chip key={t} active={brief.tone.includes(t)} onClick={() => toggleList("tone", t)}>{t}</Chip>)}<Input className="h-7 w-40 text-[12px]" placeholder="add tone ⏎" onKeyDown={(e) => { const v = e.currentTarget.value.trim(); if (e.key === "Enter" && v) { toggleList("tone", v); e.currentTarget.value = ""; } }} /></div></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Must include" hint="One per line"><Textarea rows={3} value={brief.must_include.join("\n")} onChange={(e) => updateBrief({ must_include: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} /></Field>
              <Field label="Must avoid" hint="One per line"><Textarea rows={3} value={brief.must_avoid.join("\n")} onChange={(e) => updateBrief({ must_avoid: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} /></Field>
            </div>
            <Field label="Reference notes" hint="Describe looks you cannot upload: campaigns you admire, films, palettes."><Textarea rows={2} value={brief.references_text ?? ""} onChange={(e) => updateBrief({ references_text: e.target.value || undefined })} /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Occasion"><Select value={brief.occasion ?? "none"} onChange={(e) => updateBrief({ occasion: e.target.value === "none" ? undefined : (e.target.value as CampaignBrief["occasion"]) })}>{OCCASIONS.map((o) => <option key={o} value={o}>{o === "none" ? "None" : humanize(o)}</option>)}</Select></Field>
              {isVideo ? <Field label="Film length"><Select value={String(brief.deliverables.videos?.[0]?.duration_s ?? 10)} onChange={(e) => updateBrief({ deliverables: { ...brief.deliverables, videos: [{ count: 1, duration_s: Number(e.target.value) as 10 }] } })}>{[6, 10, 15, 20, 30].map((d) => <option key={d} value={d}>{d} s</option>)}</Select></Field> : <Field label="Stills wanted"><Input type="number" min={1} max={40} value={brief.deliverables.stills ?? 6} onChange={(e) => updateBrief({ deliverables: { ...brief.deliverables, stills: Number(e.target.value) || 1 } })} /></Field>}
              <Field label="Budget (USD)"><Input type="number" value={brief.budget_usd ?? ""} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; updateBrief({ budget_usd: v }); updateSettings({ budget_cap_usd: v }); }} /></Field>
            </div>
            <Field label="Channels"><div className="flex flex-wrap gap-1.5">{CHANNELS.filter((ch) => ch.id !== "master").map((ch) => <Chip key={ch.id} active={brief.channels.includes(ch.id)} onClick={() => toggleList("channels", ch.id)}>{ch.label}</Chip>)}</div></Field>
          </section>

          <section className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-6 space-y-4">
            <SectionTitle>Products in this campaign</SectionTitle>
            {products.data?.items.length ? <div className="grid grid-cols-3 md:grid-cols-6 gap-2">{products.data.items.map((p) => { const on = c.productIds.includes(p.id); const prim = p.refs.find((r) => r.isPrimary) ?? p.refs[0]; return <AssetThumb key={p.id} asset={prim?.asset ?? null} aspect={1} selected={on} onClick={() => patchCampaign.mutate({ productIds: on ? c.productIds.filter((x) => x !== p.id) : [...c.productIds, p.id] })}><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-[11px] text-white truncate">{p.name}</div>{on ? <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg"><Check className="size-3" /></span> : null}</AssetThumb>; })}</div> : <div className="text-[12px] text-warn">No products yet.</div>}
            {c.productIds.length === 0 ? <Badge tone="warn">Pick at least one product before planning.</Badge> : null}
          </section>

          <section className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-6 space-y-4">
            <SectionTitle>Person &amp; outfit</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Person"><Select value={c.talent[0]?.talentId ?? ""} onChange={(e) => patchCampaign.mutate({ talent: e.target.value ? [{ talentId: e.target.value, outfitId: null }] : [] })}><option value="">No person — product only</option>{(talent.data?.items ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
              <Field label="Outfit"><Select value={c.talent[0]?.outfitId ?? ""} disabled={!selTalent} onChange={(e) => patchCampaign.mutate({ talent: [{ talentId: c.talent[0].talentId, outfitId: e.target.value || null }] })}><option value="">Default (neutral)</option>{(selTalent?.outfits ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-6 space-y-4">
            <SectionTitle right={<span className="text-[12px] text-fg-2">Mood boards, lighting references, locations. Tag each with what to borrow.</span>}>Style references</SectionTitle>
            <Dropzone projectId={id} role="reference" accept="image/*" compact onUploaded={(as) => patchCampaign.mutate({ refs: [...c.refs.map((r) => ({ assetId: r.assetId, role: r.role, note: r.note ?? undefined })), ...as.map((a) => ({ assetId: a.id, role: "style" }))] })} />
            {c.refs.length ? <div className="grid grid-cols-3 md:grid-cols-6 gap-3">{c.refs.map((r) => (
              <div key={r.assetId} className="space-y-1.5 group">
                <AssetThumb asset={r.asset} aspect={1} onClick={() => setOpen(r.assetId)}><button className="absolute right-1.5 top-1.5 size-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-danger cursor-pointer" onClick={(e) => { e.stopPropagation(); patchCampaign.mutate({ refs: c.refs.filter((x) => x.assetId !== r.assetId).map((x) => ({ assetId: x.assetId, role: x.role, note: x.note ?? undefined })) }); }}><Trash2 className="size-3.5" /></button></AssetThumb>
                <Select value={r.role} className="h-7 text-[12px]" onChange={(e) => patchCampaign.mutate({ refs: c.refs.map((x) => ({ assetId: x.assetId, role: x.assetId === r.assetId ? e.target.value : x.role, note: x.note ?? undefined })) })}>{REF_ROLES.map((x) => <option key={x} value={x}>{humanize(x)}</option>)}</Select>
              </div>
            ))}</div> : null}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-5 space-y-4">
            <SectionTitle>Generation settings</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label={isVideo ? "Keyframe variants" : "Variants per shot"}>{isVideo ? <Input type="number" min={1} max={6} value={settings.keyframe_variants} onChange={(e) => updateSettings({ keyframe_variants: Number(e.target.value) || 1 })} /> : <Input type="number" min={1} max={8} value={settings.variants_per_shot} onChange={(e) => updateSettings({ variants_per_shot: Number(e.target.value) || 1 })} />}</Field>
              {isVideo ? <Field label="Clip variants"><Input type="number" min={1} max={4} value={settings.clip_variants} onChange={(e) => updateSettings({ clip_variants: Number(e.target.value) || 1 })} /></Field> : <Field label="Resolution"><Select value={settings.resolution} onChange={(e) => updateSettings({ resolution: e.target.value as CampaignSettings["resolution"] })}>{["1k", "2k", "4k"].map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>}
              <Field label="Default aspect"><Select value={settings.default_aspect} onChange={(e) => updateSettings({ default_aspect: e.target.value as CampaignSettings["default_aspect"] })}>{ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
              {isVideo ? <Field label="Resolution"><Select value={settings.resolution} onChange={(e) => updateSettings({ resolution: e.target.value as CampaignSettings["resolution"] })}>{["1k", "2k", "4k"].map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field> : null}
            </div>
            <Field label="Lighting preset" hint={LIGHTING_PRESETS[settings.lighting_preset]?.description}><Select value={settings.lighting_preset} onChange={(e) => updateSettings({ lighting_preset: e.target.value })}>{Object.entries(LIGHTING_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}</Select></Field>
            <Field label="Image model" hint="Auto picks the best available lane."><Select value={settings.image_capability_override ?? ""} onChange={(e) => updateSettings({ image_capability_override: e.target.value || undefined })}><option value="">Auto · {imageImpls?.resolved.impl.label ?? "…"}</option>{[imageImpls?.resolved.impl, ...(imageImpls?.resolved.alternates ?? [])].filter(Boolean).map((i) => <option key={i!.id} value={i!.id}>{i!.label}</option>)}</Select></Field>
            {isVideo ? <Field label="Video model"><Select value={settings.video_capability_override ?? ""} onChange={(e) => updateSettings({ video_capability_override: e.target.value || undefined })}><option value="">Auto · {videoImpls?.resolved.impl.label ?? "…"}</option>{[videoImpls?.resolved.impl, ...(videoImpls?.resolved.alternates ?? [])].filter(Boolean).map((i) => <option key={i!.id} value={i!.id}>{i!.label}</option>)}</Select></Field> : null}
            <Field label="Budget cap (USD)"><Input type="number" value={settings.budget_cap_usd ?? ""} onChange={(e) => updateSettings({ budget_cap_usd: e.target.value ? Number(e.target.value) : undefined })} placeholder="No cap beyond the daily cap" /></Field>
          </section>
          <section className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-5 space-y-2 text-[12px] text-fg-1">
            <div className="text-[13px] font-medium text-fg-0">How this flows</div>
            {isVideo ? <ol className="list-decimal pl-4 space-y-1"><li>The director writes a storyboard from your brief.</li><li>Approve frames; keyframes are generated per frame.</li><li>Pick a keyframe per frame; clips are generated from it.</li><li>Assemble the cut, add music and an end card, export.</li></ol> : <ol className="list-decimal pl-4 space-y-1"><li>The director proposes a shot list.</li><li>Edit, approve, and generate variants per shot.</li><li>Review with QA scores; approve the keepers.</li><li>Refine or relight, then export per channel.</li></ol>}
          </section>
        </aside>
      </div>

      <PasteDialog open={paste} onOpenChange={setPaste} onSubmit={(t) => parse.mutate(t)} pending={parse.isPending} />
      <AssetDrawer assetId={open} onOpenChange={(o) => { if (!o) setOpen(null); }} campaignId={campaignId} />
    </div>
  );
}

function PasteDialog({ open, onOpenChange, onSubmit, pending }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (t: string) => void; pending: boolean }) {
  const [text, setText] = React.useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Paste a client brief" description="The director extracts goal, tone, channels, must-haves and deliverables into the fields. Review afterwards." wide>
        <Textarea rows={12} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the email, deck notes or doc text…" />
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={!text.trim() || pending} onClick={() => onSubmit(text)}>Parse brief</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
