"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Gem, Users, MoreHorizontal, Copy, Archive, Package, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { useGet, useAction, useAutosave } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/money";
import { RunningJobs } from "@/components/studio/widgets";
import { CHANNELS } from "@/domain/delivery";
import { CampaignCard, ProductCard, TalentCard, type ProjectFull, type CampaignLite, type ProductLite, type TalentLite } from "@/components/studio/project-cards";
import { toast } from "sonner";

export default function ProjectHub() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const project = useGet<ProjectFull>(`/api/projects/${id}`);
  const campaigns = useGet<{ items: CampaignLite[] }>(`/api/projects/${id}/campaigns`);
  const products = useGet<{ items: ProductLite[] }>(`/api/projects/${id}/products`);
  const talent = useGet<{ items: TalentLite[] }>(`/api/projects/${id}/talent`);
  const [settings, setSettings] = React.useState(false);
  const duplicate = useAction(() => api.post<{ id: string }>(`/api/projects/${id}/duplicate`), { invalidate: ["/api/projects"], success: "Project duplicated", onSuccess: (r) => router.push(`/projects/${r.id}`) });
  const exportBundle = useAction(() => api.post(`/api/projects/${id}/export`), { invalidate: ["/api/jobs"], success: "Bundle export queued — find it under Jobs" });
  const archive = useAction(() => api.del(`/api/projects/${id}`), { invalidate: ["/api/projects"], success: "Project archived", onSuccess: () => router.push("/projects") });
  const p = project.data;
  const cams = (campaigns.data?.items ?? []).filter((c) => c.status !== "archived");
  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8 space-y-10">
      <header className="flex items-end justify-between gap-6 rise-in">
        <div className="min-w-0">
          <div className="text-[12px] uppercase tracking-wide text-fg-2">{p?.clientName ?? "Project"}</div>
          {p ? <h1 className="mt-1 font-display text-[40px] leading-none truncate">{p.name}</h1> : <Skeleton className="h-10 w-80 mt-1" />}
          <div className="mt-2 flex items-center gap-2 text-[13px] text-fg-1 tabular">
            <span>{p?.campaignCount ?? 0} campaigns</span><span className="text-fg-3">·</span><span>{p?.productCount ?? 0} products</span><span className="text-fg-3">·</span><span>{p?.talentCount ?? 0} people</span><span className="text-fg-3">·</span><span>{formatUsd(p?.spendUsd)} spent</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="primary" onClick={() => router.push(`/projects/${id}/campaigns/new`)}><Plus /> New campaign</Button>
          <Button variant="ghost" onClick={() => setSettings(true)}><Settings2 /> Brand</Button>
          <Menu>
            <MenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More"><MoreHorizontal /></Button></MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => duplicate.mutate()}><Copy /> Duplicate project</MenuItem>
              <MenuItem onSelect={() => exportBundle.mutate()}><Package /> Export bundle (.zip)</MenuItem>
              <MenuSeparator />
              <MenuItem danger onSelect={() => { if (confirm("Archive this project? It stays on disk and can be restored from Projects.")) archive.mutate(); }}><Archive /> Archive</MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </header>

      <RunningJobs projectId={id} />

      <section>
        <SectionTitle right={<Button size="sm" variant="ghost" onClick={() => router.push(`/projects/${id}/campaigns/new`)}><Plus /> Campaign</Button>}>Campaigns</SectionTitle>
        {campaigns.isLoading ? <Skeleton className="h-40" /> : cams.length === 0 ? (
          <EmptyState title="No campaigns yet" body="A campaign is one brief for one or more products: stills, a video, or both. Start with a product so the director has something to shoot." action={<div className="flex gap-2"><Button variant="primary" onClick={() => router.push(`/projects/${id}/campaigns/new`)}><Plus /> New campaign</Button>{(products.data?.items.length ?? 0) === 0 ? <Button variant="ghost" onClick={() => router.push(`/projects/${id}/products/new`)}><Gem /> Add a product first</Button> : null}</div>} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{cams.map((c) => <CampaignCard key={c.id} c={c} projectId={id} />)}</div>
        )}
      </section>

      <section>
        <SectionTitle right={<Button size="sm" variant="ghost" onClick={() => router.push(`/projects/${id}/products/new`)}><Plus /> Product</Button>}>Products</SectionTitle>
        {products.isLoading ? <Skeleton className="h-32" /> : (products.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No products" body="Describe the piece (category, metal, stones, size) and upload reference photos. Every prompt is built from this." action={<Button variant="primary" onClick={() => router.push(`/projects/${id}/products/new`)}><Gem /> Add product</Button>} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">{products.data!.items.map((pr) => <ProductCard key={pr.id} p={pr} projectId={id} />)}</div>
        )}
      </section>

      <section>
        <SectionTitle right={<Button size="sm" variant="ghost" onClick={() => router.push(`/projects/${id}/talent/new`)}><Plus /> Person</Button>}>People</SectionTitle>
        {talent.isLoading ? <Skeleton className="h-32" /> : (talent.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No people yet" body="Create an original model from a short brief. Optional — product-only campaigns do not need one." action={<Button variant="ghost" onClick={() => router.push(`/projects/${id}/talent/new`)}><Users /> Create a person</Button>} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">{talent.data!.items.map((t) => <TalentCard key={t.id} t={t} projectId={id} />)}</div>
        )}
      </section>

      {p ? <BrandDialog open={settings} onOpenChange={setSettings} project={p} /> : null}
    </div>
  );
}

function BrandDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (o: boolean) => void; project: ProjectFull }) {
  const [v, setV] = React.useState({ name: project.name, clientName: project.clientName ?? "", brandNotes: project.brandNotes ?? "", palette: project.palette, defaultChannels: project.defaultChannels });
  React.useEffect(() => setV({ name: project.name, clientName: project.clientName ?? "", brandNotes: project.brandNotes ?? "", palette: project.palette, defaultChannels: project.defaultChannels }), [project]);
  const { save } = useAutosave<typeof v>((patch) => api.patch(`/api/projects/${project.id}`, patch).then(() => undefined));
  const update = (patch: Partial<typeof v>) => { setV((s) => ({ ...s, ...patch })); save(patch); };
  const toggleChannel = (id: string) => update({ defaultChannels: v.defaultChannels.includes(id) ? v.defaultChannels.filter((c) => c !== id) : [...v.defaultChannels, id] });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Brand & project" description="Autosaves. The director reads brand notes on every plan." wide>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Project name"><Input value={v.name} onChange={(e) => update({ name: e.target.value })} /></Field>
          <Field label="Client"><Input value={v.clientName} onChange={(e) => update({ clientName: e.target.value })} /></Field>
        </div>
        <Field label="Brand notes" hint="Tone, palette words, references, hard no's."><Textarea rows={6} value={v.brandNotes} onChange={(e) => update({ brandNotes: e.target.value })} /></Field>
        <Field label="Palette" hint="Hex colors, comma separated">
          <div className="flex items-center gap-2">
            <Input value={v.palette.join(", ")} onChange={(e) => update({ palette: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12) })} placeholder="#0C0C0D, #C9A96E" />
            <div className="flex gap-1">{v.palette.map((c) => <span key={c} className="size-5 rounded-full hairline" style={{ background: c }} title={c} />)}</div>
          </div>
        </Field>
        <Field label="Default channels">
          <div className="flex flex-wrap gap-1.5">{CHANNELS.filter((c) => c.id !== "master").map((c) => <Chip key={c.id} active={v.defaultChannels.includes(c.id)} onClick={() => toggleChannel(c.id)}>{c.label}</Chip>)}</div>
        </Field>
        <DialogFooter><Button variant="primary" onClick={() => { onOpenChange(false); toast.success("Saved"); }}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
