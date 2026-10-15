"use client";
import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Image as ImageIcon, Film, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useGet, useAction } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { CHANNELS } from "@/domain/delivery";
import { OCCASIONS, humanize } from "@/domain/taxonomy";
import { LIGHTING_PRESETS } from "@/domain/lighting";
import { AssetThumb } from "@/components/studio/asset-thumb";
import type { ProjectFull, ProductLite, TalentLite } from "@/components/studio/project-cards";
import { cn } from "@/lib/cn";

export default function NewCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const project = useGet<ProjectFull>(`/api/projects/${id}`);
  const products = useGet<{ items: ProductLite[] }>(`/api/projects/${id}/products`);
  const talent = useGet<{ items: TalentLite[] }>(`/api/projects/${id}/talent`);
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<"image" | "video">("image");
  const [goal, setGoal] = React.useState("");
  const [occasion, setOccasion] = React.useState<string>("none");
  const [channels, setChannels] = React.useState<string[] | null>(null);
  const [productIds, setProductIds] = React.useState<string[]>(sp.get("product") ? [sp.get("product")!] : []);
  const [talentId, setTalentId] = React.useState<string>("");
  const [outfitId, setOutfitId] = React.useState<string>("");
  const [stills, setStills] = React.useState(6);
  const [videoDur, setVideoDur] = React.useState<6 | 10 | 15 | 20 | 30>(10);
  const [preset, setPreset] = React.useState("clean_studio");
  const [budget, setBudget] = React.useState<string>("");
  const chans = channels ?? (project.data?.defaultChannels.length ? project.data.defaultChannels : [kind === "video" ? "ig_reels" : "ig_feed_45"]);
  React.useEffect(() => { if (products.data && productIds.length === 0 && products.data.items.length === 1) setProductIds([products.data.items[0].id]); }, [products.data, productIds.length]);
  const create = useAction(() => api.post<{ id: string }>(`/api/projects/${id}/campaigns`, {
    name, kind,
    brief: { goal, channels: chans, occasion: occasion === "none" ? undefined : occasion, deliverables: kind === "video" ? { videos: [{ count: 1, duration_s: videoDur }] } : { stills }, budget_usd: budget ? Number(budget) : undefined, tone: [], must_include: [], must_avoid: [] },
    settings: { lighting_preset: preset, default_aspect: kind === "video" ? "9:16" : "4:5", budget_cap_usd: budget ? Number(budget) : undefined },
    productIds, talent: talentId ? [{ talentId, outfitId: outfitId || null }] : [], refs: [],
  }), { invalidate: ["/api/projects"], success: "Campaign created", onSuccess: (r) => router.replace(`/projects/${id}/campaigns/${r.id}`) });
  const sel = talent.data?.items.find((t) => t.id === talentId);
  const valid = name.trim() && productIds.length > 0;
  return (
    <div className="mx-auto max-w-[1000px] px-8 py-8 space-y-6">
      <header className="flex items-end justify-between">
        <div><div className="text-[12px] uppercase tracking-wide text-fg-2">New campaign</div><h1 className="mt-1 font-display text-[36px] leading-none">What are we making?</h1></div>
        <div className="flex gap-2"><Button variant="ghost" onClick={() => router.back()}>Cancel</Button><Button variant="primary" disabled={!valid || create.isPending} onClick={() => create.mutate()}>Create campaign</Button></div>
      </header>
      <div className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-6 space-y-7">
        <div className="grid grid-cols-2 gap-4">
          {([["image", "Stills", ImageIcon, "A set of campaign images: hero, macro, on-model, lifestyle."], ["video", "Video", Film, "A short film built from a storyboard: keyframes → clips → assembled cut."]] as const).map(([k, label, Icon, desc]) => (
            <button key={k} onClick={() => setKind(k)} className={cn("text-left rounded-[var(--radius-md)] p-4 hairline transition-colors cursor-pointer", kind === k ? "bg-bg-3 ring-1 ring-accent" : "bg-bg-2 hover:bg-bg-3")}>
              <div className="flex items-center gap-2 text-[15px] font-medium"><Icon className="size-4" /> {label} {kind === k ? <Check className="ml-auto size-4 text-accent" /> : null}</div>
              <div className="mt-1 text-[12px] text-fg-2">{desc}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Campaign name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "video" ? "Aurora — launch film" : "Aurora — hero stills"} /></Field>
          <Field label="Occasion"><Select value={occasion} onChange={(e) => setOccasion(e.target.value)}>{OCCASIONS.map((o) => <option key={o} value={o}>{o === "none" ? "None" : humanize(o)}</option>)}</Select></Field>
        </div>
        <Field label="Goal" hint="One or two sentences. You can paste the full client brief on the next screen."><Textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Launch the Aurora solitaire for the holiday gifting window: warm, intimate, product-first." /></Field>
        <Field label="Products" hint="Select one or more. Multi-product shots are planned by the director.">
          {products.data?.items.length ? <div className="grid grid-cols-3 md:grid-cols-6 gap-2">{products.data.items.map((p) => { const on = productIds.includes(p.id); const prim = p.refs.find((r) => r.isPrimary) ?? p.refs[0]; return <AssetThumb key={p.id} asset={prim?.asset ?? null} aspect={1} selected={on} onClick={() => setProductIds(on ? productIds.filter((x) => x !== p.id) : [...productIds, p.id])}><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-[11px] text-white truncate">{p.name}</div>{on ? <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg"><Check className="size-3" /></span> : null}</AssetThumb>; })}</div> : <div className="text-[12px] text-warn">No products in this project yet. <button className="underline cursor-pointer" onClick={() => router.push(`/projects/${id}/products/new`)}>Add one</button>.</div>}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Person (optional)"><Select value={talentId} onChange={(e) => { setTalentId(e.target.value); setOutfitId(""); }}><option value="">No person — product only</option>{(talent.data?.items ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          <Field label="Outfit"><Select value={outfitId} disabled={!sel} onChange={(e) => setOutfitId(e.target.value)}><option value="">Default (neutral)</option>{(sel?.outfits ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
        </div>
        <Field label="Channels"><div className="flex flex-wrap gap-1.5">{CHANNELS.filter((c) => c.id !== "master" && (kind === "video" ? c.kind !== "image" : c.kind !== "video")).map((c) => <Chip key={c.id} active={chans.includes(c.id)} onClick={() => setChannels(chans.includes(c.id) ? chans.filter((x) => x !== c.id) : [...chans, c.id])}>{c.label}</Chip>)}</div></Field>
        <div className="grid grid-cols-3 gap-4">
          {kind === "image" ? <Field label="Stills wanted"><Input type="number" min={1} max={40} value={stills} onChange={(e) => setStills(Number(e.target.value) || 1)} /></Field> : <Field label="Film length"><Select value={String(videoDur)} onChange={(e) => setVideoDur(Number(e.target.value) as 10)}>{[6, 10, 15, 20, 30].map((d) => <option key={d} value={d}>{d} s</option>)}</Select></Field>}
          <Field label="Lighting preset"><Select value={preset} onChange={(e) => setPreset(e.target.value)}>{Object.entries(LIGHTING_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}</Select></Field>
          <Field label="Budget cap (USD, optional)"><Input type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 40" /></Field>
        </div>
      </div>
    </div>
  );
}
