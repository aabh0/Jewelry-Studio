"use client";
import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Trash2, MoreHorizontal, Check, Plus, Shirt, Fingerprint, Scissors, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent, Skeleton, Switch } from "@/components/ui/controls";
import { SectionTitle, EmptyState } from "@/components/ui/empty";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { TalentForm } from "@/components/studio/talent-form";
import { Dropzone } from "@/components/studio/dropzone";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { AssetDrawer } from "@/components/studio/asset-drawer";
import { CapabilityBadge, RunningJobs, useCapabilities } from "@/components/studio/widgets";
import { useGet, useAction, useAutosave } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { describeTalent, describeOutfit, NECKLINES, zOutfitSpec, type TalentSpec, type OutfitSpec } from "@/domain/talent";
import { humanize } from "@/domain/taxonomy";
import { cn } from "@/lib/cn";

const REF_ROLES = ["front", "three_quarter", "profile", "full_body", "expression", "hands", "ears", "neck", "sheet", "upload"] as const;
interface Ref { assetId: string; role: string; approved: number; order: number; asset: { id: string; kind: string; pathRel: string; width: number | null; height: number | null; originalName: string | null } }
interface Outfit { id: string; name: string; spec: OutfitSpec; refs: { id: string; kind: string; pathRel: string; width: number | null; height: number | null }[] }
interface Talent { id: string; projectId: string; name: string; spec: TalentSpec; lockedFeatures: string[]; identityMode: "reference_pack" | "soul_id"; soulId: string | null; soulStatus: string | null; refs: Ref[]; outfits: Outfit[] }
const LOCKABLE = ["face", "hair", "skin tone", "nails", "ears", "body"];

export default function TalentPage() {
  const { id, talentId } = useParams<{ id: string; talentId: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const q = useGet<Talent>(`/api/talent/${talentId}`);
  const caps = useCapabilities();
  const [form, setForm] = React.useState<{ name: string; spec: TalentSpec } | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [outfitDlg, setOutfitDlg] = React.useState<Outfit | "new" | null>(null);
  React.useEffect(() => { if (q.data) setForm((f) => (f ? f : { name: q.data.name, spec: q.data.spec })); }, [q.data]);
  // When the director expands the brief, refresh the form from the server copy.
  const expandedRef = React.useRef<string | null>(null);
  React.useEffect(() => { if (q.data && expandedRef.current && q.data.spec.face_notes && q.data.spec.face_notes !== expandedRef.current) { setForm({ name: q.data.name, spec: q.data.spec }); expandedRef.current = null; } }, [q.data]);
  const { save } = useAutosave<{ name: string; spec: TalentSpec }>((patch) => api.patch(`/api/talent/${talentId}`, patch).then(() => undefined));
  const onChange = (v: { name: string; spec: TalentSpec }) => { const patch: Partial<typeof v> = {}; if (v.name !== form?.name) patch.name = v.name; if (JSON.stringify(v.spec) !== JSON.stringify(form?.spec)) patch.spec = v.spec; setForm(v); if (Object.keys(patch).length) save(patch); };
  const expand = useAction(() => { expandedRef.current = form?.spec.face_notes ?? ""; return api.post(`/api/talent/${talentId}/expand`); }, { invalidate: ["/api/jobs"], success: "Director is expanding the brief" });
  const sheet = useAction((a: { kind: string; outfit_id?: string; crop_asset_id?: string }) => api.post(`/api/talent/${talentId}/sheet`, a), { invalidate: ["/api/jobs", "/api/talent"], success: (r) => ((r as { cropped?: string[] }).cropped ? "Sheet cropped into references" : "Sheet generation queued") });
  const soul = useAction(() => api.post(`/api/talent/${talentId}/soul`), { invalidate: ["/api/jobs", "/api/talent"], success: "Soul ID training queued" });
  const addRef = useAction((a: { assetId: string; role: string }) => api.post(`/api/talent/${talentId}/refs`, a), { invalidate: ["/api/talent"] });
  const patchRef = useAction((a: { assetId: string; role?: string; approved?: boolean }) => api.patch(`/api/talent/${talentId}/refs/${a.assetId}`, a), { invalidate: ["/api/talent"] });
  const removeRef = useAction((assetId: string) => api.del(`/api/talent/${talentId}/refs/${assetId}`), { invalidate: ["/api/talent"] });
  const patchTalent = useAction((a: Record<string, unknown>) => api.patch(`/api/talent/${talentId}`, a), { invalidate: ["/api/talent"] });
  const remove = useAction(() => api.del(`/api/talent/${talentId}`), { invalidate: ["/api/projects"], success: "Person deleted", onSuccess: () => router.push(`/projects/${id}`) });
  const deleteOutfit = useAction((oid: string) => api.del(`/api/outfits/${oid}`), { invalidate: ["/api/talent"] });
  const autoExpanded = React.useRef(false);
  React.useEffect(() => { if (sp.get("expand") === "1" && q.data && !autoExpanded.current && !q.data.spec.face_notes) { autoExpanded.current = true; expand.mutate(); } }, [sp, q.data, expand]);
  const t = q.data;
  if (!t || !form) return <div className="mx-auto max-w-[1200px] px-8 py-8"><Skeleton className="h-12 w-96" /><Skeleton className="mt-6 h-[480px]" /></div>;
  const identity = t.refs.filter((r) => ["front", "three_quarter", "profile", "full_body", "expression", "upload"].includes(r.role));
  const crops = t.refs.filter((r) => ["hands", "ears", "neck"].includes(r.role));
  const sheets = t.refs.filter((r) => r.role === "sheet");
  const soulCap = caps.data?.capabilities.find((c) => c.id === "talent.identity.train");
  const soulAvailable = !!soulCap && !soulCap.resolved.unavailable;
  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8 space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-[12px] uppercase tracking-wide text-fg-2">Person · original character</div>
          <h1 className="mt-1 font-display text-[36px] leading-none truncate">{form.name || "Unnamed"}</h1>
          <p className="mt-2 text-[13px] text-fg-1 max-w-[760px]">{describeTalent(form.spec)}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone={t.identityMode === "soul_id" && t.soulStatus === "ready" ? "ok" : "neutral"}>{t.identityMode === "soul_id" ? `Soul ID · ${t.soulStatus ?? "pending"}` : "Identity: reference pack"}</Badge>
            {identity.length < 2 ? <Badge tone="warn">Add at least two identity references</Badge> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" onClick={() => expand.mutate()} disabled={expand.isPending}><Sparkles /> Expand brief</Button>
          <Menu>
            <MenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More"><MoreHorizontal /></Button></MenuTrigger>
            <MenuContent><MenuItem danger onSelect={() => { if (confirm("Delete this person and their outfits?")) remove.mutate(); }}><Trash2 /> Delete person</MenuItem></MenuContent>
          </Menu>
        </div>
      </header>

      <RunningJobs projectId={id} />

      <Tabs defaultValue="identity">
        <TabsList><TabsTrigger value="identity">Identity ({t.refs.length})</TabsTrigger><TabsTrigger value="outfits">Outfits ({t.outfits.length})</TabsTrigger><TabsTrigger value="brief">Brief &amp; look</TabsTrigger></TabsList>

        <TabsContent value="identity" className="pt-5 space-y-8">
          <section className="space-y-3">
            <SectionTitle right={<CapabilityBadge id="image.character_sheet" />}>Identity sheets</SectionTitle>
            <p className="text-[12px] text-fg-2 max-w-[760px]">Generate sheets in order: A (split front/profile) locks the face; B (turnaround) and C (expressions) add angles; D (hands, ears, neck) gives jewelry-specific crops. Approve frames to use them as references, or crop a sheet into its panels.</p>
            <div className="flex flex-wrap gap-2">
              {[["split", "A · Split"], ["turnaround", "B · Turnaround"], ["expressions", "C · Expressions"], ["hands_ears_neck", "D · Hands / ears / neck"]].map(([k, label]) => <Button key={k} size="sm" variant={k === "split" && identity.length === 0 ? "primary" : "ghost"} disabled={sheet.isPending || (k !== "split" && identity.length === 0)} onClick={() => sheet.mutate({ kind: k })}>{label}</Button>)}
            </div>
            {sheets.length ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {sheets.map((r) => (
                  <div key={r.assetId} className="space-y-1.5">
                    <RefTile r={r} onOpen={() => setOpen(r.assetId)} onApprove={() => patchRef.mutate({ assetId: r.assetId, approved: !r.approved })} onRemove={() => removeRef.mutate(r.assetId)} />
                    <div className="flex gap-1"><Button size="sm" variant="ghost" className="flex-1" onClick={() => sheet.mutate({ kind: guessSheetKind(r.asset.originalName), crop_asset_id: r.assetId })}><Scissors /> Crop panels</Button></div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <SectionTitle right={<span className="text-[12px] text-fg-2">Or upload your own portraits of an original character.</span>}>Reference pack</SectionTitle>
            <Dropzone projectId={id} role="upload" accept="image/*" compact onUploaded={(as) => as.forEach((a, i) => addRef.mutate({ assetId: a.id, role: identity.length === 0 && i === 0 ? "front" : "upload" }))} />
            {identity.length === 0 && crops.length === 0 ? <EmptyState title="No identity references" body="Generate sheet A or upload portraits. Prompts use up to four approved references in this order: front, three-quarter, profile, then a crop matching the shot." /> : (
              <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-6 gap-3">
                {[...identity, ...crops].map((r) => <div key={r.assetId} className="space-y-1.5"><RefTile r={r} onOpen={() => setOpen(r.assetId)} onApprove={() => patchRef.mutate({ assetId: r.assetId, approved: !r.approved })} onRemove={() => removeRef.mutate(r.assetId)} /><Select value={r.role} onChange={(e) => patchRef.mutate({ assetId: r.assetId, role: e.target.value })} className="h-7 text-[12px]">{REF_ROLES.filter((x) => x !== "sheet").map((x) => <option key={x} value={x}>{humanize(x)}</option>)}</Select></div>)}
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-[var(--radius-md)] bg-bg-1 hairline p-4 space-y-3">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[14px] font-medium"><Lock className="size-4 text-fg-2" /> Locked features</div></div>
              <p className="text-[12px] text-fg-2">Locked features are restated in every prompt and checked by QA for identity drift.</p>
              <div className="flex flex-wrap gap-1.5">{LOCKABLE.map((f) => <Chip key={f} active={t.lockedFeatures.includes(f)} onClick={() => patchTalent.mutate({ lockedFeatures: t.lockedFeatures.includes(f) ? t.lockedFeatures.filter((x) => x !== f) : [...t.lockedFeatures, f] })}>{f}</Chip>)}</div>
            </div>
            <div className="rounded-[var(--radius-md)] bg-bg-1 hairline p-4 space-y-3">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[14px] font-medium"><Fingerprint className="size-4 text-fg-2" /> Soul ID</div><CapabilityBadge id="talent.identity.train" /></div>
              <p className="text-[12px] text-fg-2">Trains a Higgsfield Soul character from the approved references for stronger identity consistency. Needs the Higgsfield CLI and about twelve clean portraits. Otherwise the reference pack is used, which is complete on its own.</p>
              <div className="flex items-center gap-3">
                <Button size="sm" variant="ghost" disabled={!soulAvailable || soul.isPending || identity.filter((r) => r.approved).length < 4} onClick={() => soul.mutate()}>{t.soulStatus === "ready" ? "Retrain" : "Train Soul ID"}</Button>
                <div className="flex items-center gap-2 text-[12px] text-fg-1"><Switch checked={t.identityMode === "soul_id"} disabled={t.soulStatus !== "ready"} onCheckedChange={(v) => patchTalent.mutate({ identityMode: v ? "soul_id" : "reference_pack" })} /> Use Soul ID when available</div>
              </div>
              {!soulAvailable ? <div className="text-[11px] text-fg-3">{soulCap?.resolved.reason ?? "Unavailable in this setup."}</div> : null}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="outfits" className="pt-5 space-y-4">
          <SectionTitle right={<Button size="sm" variant="primary" onClick={() => setOutfitDlg("new")}><Plus /> Outfit</Button>}>Outfits</SectionTitle>
          <p className="text-[12px] text-fg-2 max-w-[760px]">Outfits are described, not uploaded: necklines matter for necklaces, sleeves for bracelets. Add a reference photo per outfit if you have one, then generate an outfit sheet so the look stays consistent across shots.</p>
          {t.outfits.length === 0 ? <EmptyState title="No outfits" body="Shots fall back to a neutral, product-friendly outfit when none is assigned." action={<Button variant="ghost" onClick={() => setOutfitDlg("new")}><Shirt /> Add an outfit</Button>} /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {t.outfits.map((o) => (
                <div key={o.id} className="rounded-[var(--radius-md)] bg-bg-1 hairline p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2"><div><div className="text-[14px] font-medium">{o.name}</div><div className="mt-0.5 text-[12px] text-fg-2">{describeOutfit(o.spec)}</div></div><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setOutfitDlg(o)}>Edit</Button><Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => deleteOutfit.mutate(o.id)}><Trash2 /></Button></div></div>
                  <div className="flex gap-2 overflow-x-auto">{o.refs.map((a) => <AssetThumb key={a.id} asset={a} aspect={4 / 5} className="w-20 shrink-0" onClick={() => setOpen(a.id)} />)}</div>
                  <div className="flex gap-2"><OutfitUpload projectId={id} outfitId={o.id} /><Button size="sm" variant="ghost" disabled={sheet.isPending} onClick={() => sheet.mutate({ kind: "outfit", outfit_id: o.id })}><Sparkles /> Outfit sheet</Button></div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="brief" className="pt-5">
          <div className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-6"><TalentForm name={form.name} spec={form.spec} onChange={onChange} /></div>
        </TabsContent>
      </Tabs>

      <AssetDrawer assetId={open} onOpenChange={(o) => { if (!o) setOpen(null); }} />
      <OutfitDialog talentId={talentId} outfit={outfitDlg} onOpenChange={(o) => { if (!o) setOutfitDlg(null); }} />
    </div>
  );
}

function guessSheetKind(name: string | null): string {
  const n = (name ?? "").toLowerCase();
  if (/turn/.test(n)) return "turnaround";
  if (/expr/.test(n)) return "expressions";
  if (/hand|ear|neck/.test(n)) return "hands_ears_neck";
  if (/outfit/.test(n)) return "outfit";
  return "split";
}

function RefTile({ r, onOpen, onApprove, onRemove }: { r: Ref; onOpen: () => void; onApprove: () => void; onRemove: () => void }) {
  return (
    <div className={cn("group", !r.approved && "opacity-60")}>
      <AssetThumb asset={r.asset} aspect={1} onClick={onOpen}>
        <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip content={r.approved ? "Exclude" : "Include"}><button className={cn("size-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer", r.approved && "bg-ok/80")} onClick={(e) => { e.stopPropagation(); onApprove(); }}><Check className="size-3.5" /></button></Tooltip>
          <Tooltip content="Remove"><button className="size-7 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer hover:bg-danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}><Trash2 className="size-3.5" /></button></Tooltip>
        </div>
        <Badge className="absolute left-1.5 top-1.5">{humanize(r.role)}</Badge>
      </AssetThumb>
    </div>
  );
}

function OutfitUpload({ projectId, outfitId }: { projectId: string; outfitId: string }) {
  const add = useAction((assetId: string) => api.post(`/api/outfits/${outfitId}/refs`, { assetId }), { invalidate: ["/api/talent"] });
  return <Dropzone projectId={projectId} role="upload" accept="image/*" compact label="Add outfit photo" className="flex-1" onUploaded={(as) => as.forEach((a) => add.mutate(a.id))} />;
}

function OutfitDialog({ talentId, outfit, onOpenChange }: { talentId: string; outfit: Outfit | "new" | null; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = React.useState("");
  const [spec, setSpec] = React.useState<OutfitSpec>(zOutfitSpec.parse({}));
  React.useEffect(() => { if (outfit === "new") { setName(""); setSpec(zOutfitSpec.parse({})); } else if (outfit) { setName(outfit.name); setSpec(outfit.spec); } }, [outfit]);
  const create = useAction(() => api.post(`/api/talent/${talentId}/outfits`, { name, spec }), { invalidate: ["/api/talent"], success: "Outfit added", onSuccess: () => onOpenChange(false) });
  const update = useAction(() => api.patch(`/api/outfits/${(outfit as Outfit).id}`, { name, spec }), { invalidate: ["/api/talent"], success: "Outfit saved", onSuccess: () => onOpenChange(false) });
  return (
    <Dialog open={!!outfit} onOpenChange={onOpenChange}>
      <DialogContent title={outfit === "new" ? "New outfit" : "Edit outfit"} description="Keep it product-friendly: solid colors, clean necklines, no competing jewelry.">
        <div className="space-y-4">
          <Field label="Name"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ivory silk slip" /></Field>
          <Field label="Description"><Textarea value={spec.description} onChange={(e) => setSpec({ ...spec, description: e.target.value })} placeholder="Ivory silk slip dress with thin straps; no other jewelry." /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Neckline"><Select value={spec.neckline} onChange={(e) => setSpec({ ...spec, neckline: e.target.value as OutfitSpec["neckline"] })}>{NECKLINES.map((n) => <option key={n} value={n}>{humanize(n)}</option>)}</Select></Field>
            <Field label="Fabric finish"><Select value={spec.fabric_finish} onChange={(e) => setSpec({ ...spec, fabric_finish: e.target.value as OutfitSpec["fabric_finish"] })}>{["matte", "satin", "knit", "linen", "silk"].map((n) => <option key={n} value={n}>{humanize(n)}</option>)}</Select></Field>
            <Field label="Palette" hint="comma separated"><Input value={spec.palette.join(", ")} onChange={(e) => setSpec({ ...spec, palette: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="ivory, bone" /></Field>
          </div>
          <Field label="Notes"><Input value={spec.notes ?? ""} onChange={(e) => setSpec({ ...spec, notes: e.target.value || undefined })} /></Field>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" disabled={!name.trim()} onClick={() => (outfit === "new" ? create.mutate() : update.mutate())}>{outfit === "new" ? "Add outfit" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
