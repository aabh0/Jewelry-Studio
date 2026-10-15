"use client";
import * as React from "react";
import { Field, Select } from "@/components/ui/input";
import { Chip } from "@/components/ui/badge";
import { LIGHT_SETUPS, KEY_QUALITIES, KEY_DIRECTIONS, FILLS, NEGATIVE_FILLS, RIMS, SPARKLES, REFLECTION_STYLES, COLOR_TEMPS, WHITE_BALANCES, MOODS, BACKGROUNDS, SURFACE_FINISHES, LIGHTING_PRESETS, describeLighting, type LightingSpec, zLightingSpec, lightingFromPreset } from "@/domain/lighting";
import { humanize } from "@/domain/taxonomy";
import { Input } from "@/components/ui/input";

export function LightingEditor({ value, onChange, notes, compact }: { value: LightingSpec; onChange: (l: LightingSpec) => void; notes?: string[]; compact?: boolean }) {
  const set = <K extends keyof LightingSpec>(k: K, v: LightingSpec[K]) => onChange(zLightingSpec.parse({ ...value, [k]: v }));
  const sel = (k: keyof LightingSpec, opts: readonly (string | number)[], label: string) => (
    <Field label={label}>
      <Select value={String(value[k] ?? "")} onChange={(e) => set(k, (typeof opts[0] === "number" ? Number(e.target.value) : e.target.value) as never)}>
        {opts.map((o) => <option key={String(o)} value={String(o)}>{typeof o === "number" ? `${o}K` : humanize(String(o))}</option>)}
      </Select>
    </Field>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(LIGHTING_PRESETS).map(([id, p]) => <Chip key={id} title={p.description} onClick={() => onChange(lightingFromPreset(id))}>{p.name}</Chip>)}
      </div>
      <div className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 md:grid-cols-3 gap-2"}>
        {sel("setup", LIGHT_SETUPS, "Setup")}
        {sel("key_quality", KEY_QUALITIES, "Key quality")}
        {sel("key_direction", KEY_DIRECTIONS, "Key direction")}
        {sel("fill", FILLS, "Fill")}
        {sel("negative_fill", NEGATIVE_FILLS, "Negative fill")}
        {sel("rim", RIMS, "Rim")}
        {sel("sparkle", SPARKLES, "Sparkle")}
        {sel("reflection_style", REFLECTION_STYLES, "Reflections")}
        {sel("color_temp_k", COLOR_TEMPS, "Color temp")}
        {sel("white_balance", WHITE_BALANCES, "White balance")}
        {sel("mood", MOODS, "Mood")}
        {sel("background", BACKGROUNDS, "Background")}
        {sel("surface_finish", SURFACE_FINISHES, "Surface finish")}
        {value.background === "custom" ? <Field label="Custom background"><Input value={value.background_custom ?? ""} onChange={(e) => set("background_custom", e.target.value)} placeholder="e.g. a sunlit marble terrace" /></Field> : null}
      </div>
      <div className="rounded-[var(--radius-md)] bg-bg-2 p-3 text-[12px] leading-relaxed text-fg-1">
        <span className="text-fg-2">Compiles to: </span>{describeLighting(value)}
      </div>
      {notes?.length ? <ul className="text-[12px] text-warn space-y-0.5">{notes.map((n) => <li key={n}>• {n}</li>)}</ul> : null}
    </div>
  );
}
