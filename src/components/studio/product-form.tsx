"use client";
import * as React from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip, Badge } from "@/components/ui/badge";
import { JEWELRY_CATEGORIES, SUBTYPES_BY_CATEGORY, METALS, KARATS, FINISHES, STONE_TYPES, STONE_SHAPES, STONE_ROLES, SETTINGS, CLASPS, CHAIN_STYLES, FINGERS, HANDS, EAR_SIDES, humanize } from "@/domain/taxonomy";
import { zProductSpec, type ProductSpec, type Stone, validateProductSpec, deriveInvariants, normalizeProductSpec } from "@/domain/product";
import { Plus, Trash2 } from "lucide-react";

export interface ProductFormValue { name: string; sku: string; spec: ProductSpec; invariants: string[]; notes: string }

export function defaultProductSpec(): ProductSpec {
  return zProductSpec.parse({ category: "ring", subtype: "solitaire", metal: { type: "yellow_gold", karat: 18, finish: "high_polish" }, stones: [{ role: "center", type: "diamond", shape: "round_brilliant", carat: 1 }], setting: { type: "prong", prong_count: 4 }, dimensions: { band_width_mm: 2 } });
}

export function ProductForm({ value, onChange }: { value: ProductFormValue; onChange: (v: ProductFormValue) => void }) {
  const spec = value.spec;
  const setSpec = (patch: Partial<ProductSpec>) => onChange({ ...value, spec: zProductSpec.parse({ ...spec, ...patch }) });
  const setStone = (i: number, patch: Partial<Stone>) => setSpec({ stones: spec.stones.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const validation = validateProductSpec(spec);
  const derived = React.useMemo(() => deriveInvariants(spec), [spec]);
  const norm = normalizeProductSpec(spec);
  const num = (v: string) => (v === "" ? undefined : Number(v));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Aurora solitaire" /></Field>
        <Field label="SKU (optional)"><Input value={value.sku} onChange={(e) => onChange({ ...value, sku: e.target.value })} /></Field>
      </div>
      <section className="space-y-3">
        <h4 className="text-[12px] uppercase tracking-wide text-fg-2">Piece</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Category"><Select value={spec.category} onChange={(e) => setSpec({ category: e.target.value as ProductSpec["category"], subtype: SUBTYPES_BY_CATEGORY[e.target.value as ProductSpec["category"]][0] })}>{JEWELRY_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}</Select></Field>
          <Field label="Subtype"><Select value={spec.subtype ?? ""} onChange={(e) => setSpec({ subtype: e.target.value })}>{SUBTYPES_BY_CATEGORY[spec.category].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select></Field>
          <Field label="Metal"><Select value={spec.metal.type} onChange={(e) => setSpec({ metal: { ...spec.metal, type: e.target.value as ProductSpec["metal"]["type"] } })}>{METALS.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}</Select></Field>
          <Field label="Karat"><Select value={String(spec.metal.karat ?? "")} onChange={(e) => setSpec({ metal: { ...spec.metal, karat: e.target.value ? (Number(e.target.value) as 18) : undefined } })}><option value="">—</option>{KARATS.map((k) => <option key={k} value={k}>{k}k</option>)}</Select></Field>
          <Field label="Finish"><Select value={spec.metal.finish} onChange={(e) => setSpec({ metal: { ...spec.metal, finish: e.target.value as ProductSpec["metal"]["finish"] } })}>{FINISHES.map((f) => <option key={f} value={f}>{humanize(f)}</option>)}</Select></Field>
          <Field label="Plating"><Select value={spec.metal.plating ?? "none"} onChange={(e) => setSpec({ metal: { ...spec.metal, plating: e.target.value as "rhodium" | "none" } })}><option value="none">None</option><option value="rhodium">Rhodium</option></Select></Field>
          <Field label="Size label" hint='e.g. "US 6", "18 in"'><Input value={spec.size_label ?? ""} onChange={(e) => setSpec({ size_label: e.target.value || undefined })} /></Field>
          <Field label="Primary setting"><Select value={spec.setting?.type ?? ""} onChange={(e) => setSpec({ setting: e.target.value ? { ...(spec.setting ?? {}), type: e.target.value as ProductSpec["setting"] extends infer S ? S extends { type: infer T } ? T : never : never } : undefined })}><option value="">—</option>{SETTINGS.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}</Select></Field>
          {spec.setting?.type === "prong" ? <Field label="Prong count" hint="Required: AI drifts between 4 and 6"><Select value={String(spec.setting.prong_count ?? "")} onChange={(e) => setSpec({ setting: { ...spec.setting!, prong_count: e.target.value ? (Number(e.target.value) as 4) : undefined } })}><option value="">—</option>{[2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field> : null}
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h4 className="text-[12px] uppercase tracking-wide text-fg-2">Stones</h4><Button size="sm" variant="ghost" onClick={() => setSpec({ stones: [...spec.stones, { role: "accent", type: "diamond", shape: "round_brilliant", count: 2 }] })}><Plus /> Add stone</Button></div>
        {spec.stones.length === 0 ? <p className="text-[12px] text-fg-2">No stones (plain metal).</p> : null}
        {spec.stones.map((s, i) => (
          <div key={i} className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end rounded-[var(--radius-md)] bg-bg-2 p-2">
            <Field label="Role"><Select value={s.role} onChange={(e) => setStone(i, { role: e.target.value as Stone["role"] })}>{STONE_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}</Select></Field>
            <Field label="Type"><Select value={s.type} onChange={(e) => setStone(i, { type: e.target.value as Stone["type"] })}>{STONE_TYPES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}</Select></Field>
            <Field label="Shape"><Select value={s.shape} onChange={(e) => setStone(i, { shape: e.target.value as Stone["shape"] })}>{STONE_SHAPES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}</Select></Field>
            <Field label="Carat"><Input type="number" step="0.01" value={s.carat ?? ""} onChange={(e) => setStone(i, { carat: num(e.target.value), mm: undefined })} /></Field>
            <Field label="mm" hint={norm.stones[i]?.mm && !s.mm ? `derived ${norm.stones[i].mm!.join("×")}` : undefined}><Input value={s.mm?.join("×") ?? ""} placeholder={norm.stones[i]?.mm?.join("×")} onChange={(e) => setStone(i, { mm: e.target.value ? e.target.value.split(/[x×,]/).map(Number).filter((n) => n > 0) : undefined })} /></Field>
            <Field label="Count"><Input type="number" value={s.count ?? ""} onChange={(e) => setStone(i, { count: num(e.target.value) })} /></Field>
            <div className="flex items-end"><Button size="icon-sm" variant="ghost" onClick={() => setSpec({ stones: spec.stones.filter((_, j) => j !== i) })} aria-label="Remove stone"><Trash2 /></Button></div>
          </div>
        ))}
      </section>
      {(spec.category === "necklace" || spec.category === "bracelet" || spec.category === "anklet") ? (
        <section className="space-y-3">
          <h4 className="text-[12px] uppercase tracking-wide text-fg-2">Chain</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Style"><Select value={spec.chain?.style ?? ""} onChange={(e) => setSpec({ chain: { ...spec.chain, style: (e.target.value || undefined) as never } })}><option value="">—</option>{CHAIN_STYLES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}</Select></Field>
            <Field label="Length (in)"><Input type="number" step="0.5" value={spec.chain?.length_in ?? ""} placeholder={spec.category === "necklace" ? "18" : "7"} onChange={(e) => setSpec({ chain: { ...spec.chain, length_in: num(e.target.value) } })} /></Field>
            <Field label="Width (mm)"><Input type="number" step="0.1" value={spec.chain?.width_mm ?? ""} onChange={(e) => setSpec({ chain: { ...spec.chain, width_mm: num(e.target.value) } })} /></Field>
            <Field label="Clasp"><Select value={spec.chain?.clasp ?? ""} onChange={(e) => setSpec({ chain: { ...spec.chain, clasp: (e.target.value || undefined) as never } })}><option value="">—</option>{CLASPS.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}</Select></Field>
          </div>
        </section>
      ) : null}
      <section className="space-y-3">
        <h4 className="text-[12px] uppercase tracking-wide text-fg-2">Dimensions &amp; wear</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {spec.category === "ring" ? <>
            <Field label="Band width (mm)"><Input type="number" step="0.1" value={spec.dimensions?.band_width_mm ?? ""} onChange={(e) => setSpec({ dimensions: { ...spec.dimensions, band_width_mm: num(e.target.value) } })} /></Field>
            <Field label="Band thickness (mm)"><Input type="number" step="0.1" value={spec.dimensions?.band_thickness_mm ?? ""} onChange={(e) => setSpec({ dimensions: { ...spec.dimensions, band_thickness_mm: num(e.target.value) } })} /></Field>
            <Field label="Hand"><Select value={spec.wear?.hand ?? ""} onChange={(e) => setSpec({ wear: { ...spec.wear, hand: (e.target.value || undefined) as never } })}><option value="">default</option>{HANDS.map((h) => <option key={h} value={h}>{humanize(h)}</option>)}</Select></Field>
            <Field label="Finger"><Select value={spec.wear?.finger ?? ""} onChange={(e) => setSpec({ wear: { ...spec.wear, finger: (e.target.value || undefined) as never } })}><option value="">default</option>{FINGERS.map((h) => <option key={h} value={h}>{humanize(h)}</option>)}</Select></Field>
          </> : null}
          {spec.category === "earring" ? <>
            <Field label="Diameter (mm)"><Input type="number" step="0.5" value={spec.dimensions?.diameter_mm ?? ""} onChange={(e) => setSpec({ dimensions: { ...spec.dimensions, diameter_mm: num(e.target.value) } })} /></Field>
            <Field label="Drop (mm)"><Input type="number" step="1" value={spec.dimensions?.drop_mm ?? ""} onChange={(e) => setSpec({ dimensions: { ...spec.dimensions, drop_mm: num(e.target.value) } })} /></Field>
            <Field label="Ear side"><Select value={spec.wear?.ear_side ?? "both"} onChange={(e) => setSpec({ wear: { ...spec.wear, ear_side: e.target.value as never } })}>{EAR_SIDES.map((h) => <option key={h} value={h}>{humanize(h)}</option>)}</Select></Field>
          </> : null}
          {["bracelet", "brooch", "watch", "cufflink", "body_jewelry", "necklace"].includes(spec.category) ? <>
            <Field label="Width (mm)"><Input type="number" step="0.5" value={spec.dimensions?.width_mm ?? ""} onChange={(e) => setSpec({ dimensions: { ...spec.dimensions, width_mm: num(e.target.value) } })} /></Field>
            <Field label="Length (mm)"><Input type="number" step="1" value={spec.dimensions?.length_mm ?? ""} onChange={(e) => setSpec({ dimensions: { ...spec.dimensions, length_mm: num(e.target.value) } })} /></Field>
            {spec.category === "watch" ? <Field label="Case (mm)"><Input type="number" step="1" value={spec.dimensions?.case_mm ?? ""} onChange={(e) => setSpec({ dimensions: { ...spec.dimensions, case_mm: num(e.target.value) } })} /></Field> : null}
            {spec.category === "bracelet" ? <Field label="Inner diameter (mm)"><Input type="number" step="1" value={spec.dimensions?.inner_diameter_mm ?? ""} onChange={(e) => setSpec({ dimensions: { ...spec.dimensions, inner_diameter_mm: num(e.target.value) } })} /></Field> : null}
          </> : null}
          <Field label="Hallmarks / engraving" hint="comma separated; must read exactly or stay out of frame"><Input value={spec.hallmarks.join(", ")} onChange={(e) => setSpec({ hallmarks: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></Field>
        </div>
        <Field label="Free description (optional)"><Textarea value={spec.description_freeform ?? ""} onChange={(e) => setSpec({ description_freeform: e.target.value || undefined })} placeholder="Anything the structured fields cannot express: engraving pattern, mixed metals, special construction…" /></Field>
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] uppercase tracking-wide text-fg-2">Fidelity invariants</h4>
          <Button size="sm" variant="ghost" onClick={() => onChange({ ...value, invariants: derived })}>Reset to derived</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {value.invariants.map((inv, i) => <Chip key={i} active onClick={() => onChange({ ...value, invariants: value.invariants.filter((_, j) => j !== i) })} title="Click to remove">{inv} ×</Chip>)}
        </div>
        <Input placeholder="Add an invariant and press Enter" onKeyDown={(e) => { if (e.key === "Enter" && e.currentTarget.value.trim()) { onChange({ ...value, invariants: [...value.invariants, e.currentTarget.value.trim()] }); e.currentTarget.value = ""; } }} />
      </section>
      <Field label="Notes"><Textarea value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} /></Field>
      {validation.errors.map((er) => <Badge key={er} tone="danger">{er}</Badge>)}
      {validation.warnings.map((w) => <Badge key={w} tone="warn">{w}</Badge>)}
    </div>
  );
}
