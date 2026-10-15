"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Star, Trash2, Scissors, LayoutGrid, Check, MoreHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from "@/components/ui/controls";
import { SectionTitle, EmptyState } from "@/components/ui/empty";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { ProductForm, type ProductFormValue } from "@/components/studio/product-form";
import { Dropzone } from "@/components/studio/dropzone";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { AssetDrawer } from "@/components/studio/asset-drawer";
import { CapabilityBadge, RunningJobs } from "@/components/studio/widgets";
import { useGet, useAction, useAutosave } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { describeProduct, type ProductSpec } from "@/domain/product";
import { cn } from "@/lib/cn";

const REF_ROLES = ["front", "three_quarter", "profile", "back", "macro", "worn", "packaging", "plate", "sheet", "other"] as const;
interface Ref { assetId: string; role: string; isPrimary: number; approved: number; order: number; asset: { id: string; kind: string; pathRel: string; width: number | null; height: number | null; originalName: string | null; role: string } }
interface Product { id: string; projectId: string; name: string; sku: string | null; notes: string | null; spec: ProductSpec; invariants: string[]; learnedAvoids: string[]; refs: Ref[]; validation: { errors: string[]; warnings: string[] } }

export default function ProductPage() {
  const { id, productId } = useParams<{ id: string; productId: string }>();
  const router = useRouter();
  const q = useGet<Product>(`/api/products/${productId}`);
  const [form, setForm] = React.useState<ProductFormValue | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  React.useEffect(() => { if (q.data && !form) setForm({ name: q.data.name, sku: q.data.sku ?? "", spec: q.data.spec, invariants: q.data.invariants, notes: q.data.notes ?? "" }); }, [q.data, form]);
  const { save } = useAutosave<ProductFormValue>((patch) => api.patch(`/api/products/${productId}`, { ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.sku !== undefined ? { sku: patch.sku || null } : {}), ...(patch.spec ? { spec: patch.spec } : {}), ...(patch.invariants ? { invariants: patch.invariants } : {}), ...(patch.notes !== undefined ? { notes: patch.notes || null } : {}) }).then(() => undefined));
  const onChange = (v: ProductFormValue) => {
    const patch: Partial<ProductFormValue> = {};
    for (const k of Object.keys(v) as (keyof ProductFormValue)[]) if (JSON.stringify(v[k]) !== JSON.stringify(form?.[k])) (patch as Record<string, unknown>)[k] = v[k];
    setForm(v);
    if (Object.keys(patch).length) save(patch);
  };
  const addRef = useAction((a: { assetId: string; role: string; isPrimary?: boolean }) => api.post(`/api/products/${productId}/refs`, a), { invalidate: ["/api/products", "/api/projects"] });
  const patchRef = useAction((a: { assetId: string; role?: string; isPrimary?: boolean; approved?: boolean }) => api.patch(`/api/products/${productId}/refs/${a.assetId}`, a), { invalidate: ["/api/products"] });
  const removeRef = useAction((assetId: string) => api.del(`/api/products/${productId}/refs/${assetId}`), { invalidate: ["/api/products"] });
  const prepare = useAction((a: { plate: boolean; sheet: boolean; assetId?: string }) => api.post(`/api/products/${productId}/prepare`, a), { invalidate: ["/api/jobs"], success: (r) => `Queued ${Object.keys((r as { jobs: Record<string, string> }).jobs).join(" + ")}` });
  const remove = useAction(() => api.del(`/api/products/${productId}`), { invalidate: ["/api/projects"], success: "Product deleted", onSuccess: () => router.push(`/projects/${id}`) });
  const clearAvoids = useAction(() => api.patch(`/api/products/${productId}`, { learnedAvoids: [] }), { invalidate: ["/api/products"] });
  const p = q.data;
  if (!p || !form) return <div className="mx-auto max-w-[1200px] px-8 py-8"><Skeleton className="h-12 w-96" /><Skeleton className="mt-6 h-[480px]" /></div>;
  const primary = p.refs.find((r) => r.isPrimary);
  const plate = p.refs.find((r) => r.role === "plate");
  const uploads = p.refs.filter((r) => r.role !== "plate" && r.role !== "sheet");
  const sheets = p.refs.filter((r) => r.role === "sheet");
  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8 space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-[12px] uppercase tracking-wide text-fg-2">Product</div>
          <h1 className="mt-1 font-display text-[36px] leading-none truncate">{form.name || "Untitled"}</h1>
          <p className="mt-2 text-[13px] text-fg-1 max-w-[760px]">{describeProduct(p.spec)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{p.validation.errors.map((e) => <Badge key={e} tone="danger">{e}</Badge>)}{p.validation.warnings.map((e) => <Badge key={e} tone="warn">{e}</Badge>)}</div>
        </div>
        <Menu>
          <MenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More"><MoreHorizontal /></Button></MenuTrigger>
          <MenuContent><MenuItem danger onSelect={() => { if (confirm("Delete this product? Campaign shots that use it will lose their product.")) remove.mutate(); }}><Trash2 /> Delete product</MenuItem></MenuContent>
        </Menu>
      </header>

      <RunningJobs projectId={id} />

      <Tabs defaultValue="refs">
        <TabsList><TabsTrigger value="refs">References ({p.refs.length})</TabsTrigger><TabsTrigger value="spec">Specification</TabsTrigger></TabsList>
        <TabsContent value="refs" className="pt-5 space-y-8">
          <section className="space-y-3">
            <SectionTitle right={<span className="text-[12px] text-fg-2">Upload 3–8 angles. Mark the cleanest front view as primary.</span>}>Uploads</SectionTitle>
            <Dropzone projectId={id} role="upload" accept="image/*" onUploaded={(as) => as.forEach((a, i) => addRef.mutate({ assetId: a.id, role: guessRole(a.originalName, i + uploads.length), isPrimary: uploads.length === 0 && i === 0 }))} />
            {uploads.length === 0 ? <EmptyState title="No reference photos yet" body="Generation without photos uses the spec only; fidelity drops. Add at least a front and a three-quarter view." /> : (
              <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-6 gap-3">
                {uploads.map((r) => <RefTile key={r.assetId} r={r} onOpen={() => setOpen(r.assetId)} onRole={(role) => patchRef.mutate({ assetId: r.assetId, role })} onPrimary={() => patchRef.mutate({ assetId: r.assetId, isPrimary: true })} onApprove={() => patchRef.mutate({ assetId: r.assetId, approved: !r.approved })} onRemove={() => removeRef.mutate(r.assetId)} />)}
              </div>
            )}
          </section>
          <section className="space-y-3">
            <SectionTitle right={<div className="flex items-center gap-2"><CapabilityBadge id="image.clean_plate" /><CapabilityBadge id="image.product_sheet" /></div>}>Prepared references</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-[var(--radius-md)] bg-bg-1 hairline p-4 space-y-3">
                <div className="flex items-center justify-between"><div><div className="text-[14px] font-medium">Clean plate</div><div className="text-[12px] text-fg-2">Background removed from the primary photo. Becomes the first reference in every prompt.</div></div><Button size="sm" variant={plate ? "ghost" : "primary"} disabled={!primary || prepare.isPending} onClick={() => prepare.mutate({ plate: true, sheet: false, assetId: primary?.assetId })}><Scissors /> {plate ? "Redo" : "Make plate"}</Button></div>
                {plate ? <AssetThumb asset={plate.asset} aspect={1} className="max-w-[220px]" onClick={() => setOpen(plate.assetId)} /> : <div className="text-[12px] text-fg-3">{primary ? "Not made yet." : "Upload a primary photo first."}</div>}
              </div>
              <div className="rounded-[var(--radius-md)] bg-bg-1 hairline p-4 space-y-3">
                <div className="flex items-center justify-between"><div><div className="text-[14px] font-medium">Product sheet</div><div className="text-[12px] text-fg-2">Generated turnaround (front, ¾, profile, macro) on grey. Approve frames to use them as extra references.</div></div><Button size="sm" variant={sheets.length ? "ghost" : "primary"} disabled={!primary || prepare.isPending} onClick={() => prepare.mutate({ plate: false, sheet: true })}><LayoutGrid /> {sheets.length ? "Another" : "Generate sheet"}</Button></div>
                {sheets.length ? <div className="grid grid-cols-3 gap-2">{sheets.map((r) => <RefTile key={r.assetId} r={r} compact onOpen={() => setOpen(r.assetId)} onApprove={() => patchRef.mutate({ assetId: r.assetId, approved: !r.approved })} onRemove={() => removeRef.mutate(r.assetId)} />)}</div> : <div className="text-[12px] text-fg-3">Not generated yet.</div>}
              </div>
            </div>
          </section>
          {p.learnedAvoids.length ? (
            <section className="space-y-2">
              <SectionTitle right={<Button size="sm" variant="ghost" onClick={() => clearAvoids.mutate()}>Clear</Button>}>Learned avoids</SectionTitle>
              <p className="text-[12px] text-fg-2">Defects QA keeps flagging for this piece. They are added to the AVOID block automatically.</p>
              <div className="flex flex-wrap gap-1.5">{p.learnedAvoids.map((a) => <Badge key={a} tone="warn">{a}</Badge>)}</div>
            </section>
          ) : null}
        </TabsContent>
        <TabsContent value="spec" className="pt-5">
          <div className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-6"><ProductForm value={form} onChange={onChange} /></div>
        </TabsContent>
      </Tabs>
      <AssetDrawer assetId={open} onOpenChange={(o) => { if (!o) setOpen(null); }} productId={productId} />
      <div className="flex justify-end"><Button variant="primary" onClick={() => router.push(`/projects/${id}/campaigns/new?product=${productId}`)}><Sparkles /> Start a campaign with this piece</Button></div>
    </div>
  );
}

function guessRole(name: string | null, i: number): string {
  const n = (name ?? "").toLowerCase();
  if (/front|hero/.test(n)) return "front";
  if (/3-?4|three|quarter|angle/.test(n)) return "three_quarter";
  if (/side|profile/.test(n)) return "profile";
  if (/back|rear/.test(n)) return "back";
  if (/macro|detail|close/.test(n)) return "macro";
  if (/worn|model|hand|neck|ear/.test(n)) return "worn";
  if (/box|pack/.test(n)) return "packaging";
  return i === 0 ? "front" : i === 1 ? "three_quarter" : "other";
}

function RefTile({ r, onOpen, onRole, onPrimary, onApprove, onRemove, compact }: { r: Ref; onOpen: () => void; onRole?: (role: string) => void; onPrimary?: () => void; onApprove: () => void; onRemove: () => void; compact?: boolean }) {
  return (
    <div className={cn("group space-y-1.5", !r.approved && "opacity-60")}>
      <AssetThumb asset={r.asset} aspect={1} onClick={onOpen} selected={!!r.isPrimary}>
        <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onPrimary ? <Tooltip content="Make primary"><button className={cn("size-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer", r.isPrimary && "bg-accent text-accent-fg opacity-100")} onClick={(e) => { e.stopPropagation(); onPrimary(); }}><Star className="size-3.5" /></button></Tooltip> : null}
          <Tooltip content={r.approved ? "Exclude from generation" : "Include in generation"}><button className={cn("size-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer", r.approved && "bg-ok/80")} onClick={(e) => { e.stopPropagation(); onApprove(); }}><Check className="size-3.5" /></button></Tooltip>
          <Tooltip content="Remove"><button className="size-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer hover:bg-danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}><Trash2 className="size-3.5" /></button></Tooltip>
        </div>
        {r.isPrimary ? <Badge tone="accent" className="absolute left-1.5 top-1.5">primary</Badge> : null}
      </AssetThumb>
      {!compact && onRole ? <Select value={r.role} onChange={(e) => onRole(e.target.value)} className="h-7 text-[12px]">{REF_ROLES.filter((x) => x !== "plate" && x !== "sheet").map((x) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}</Select> : <div className="text-[11px] text-fg-2 truncate px-0.5">{r.asset.originalName ?? r.role}</div>}
    </div>
  );
}

