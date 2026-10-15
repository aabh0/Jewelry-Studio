"use client";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { zTalentSpec, type TalentSpec, NAILS, HAIR_STATES, MONK_WORDS } from "@/domain/talent";
import { humanize } from "@/domain/taxonomy";

export function TalentForm({ name, spec, onChange }: { name: string; spec: TalentSpec; onChange: (v: { name: string; spec: TalentSpec }) => void }) {
  const set = (patch: Partial<TalentSpec>) => onChange({ name, spec: zTalentSpec.parse({ ...spec, ...patch }) });
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><Input value={name} onChange={(e) => onChange({ name: e.target.value, spec })} placeholder="Mara" /></Field>
        <Field label="Presents as"><Select value={spec.gender_presentation} onChange={(e) => set({ gender_presentation: e.target.value as TalentSpec["gender_presentation"] })}><option value="woman">Woman</option><option value="man">Man</option><option value="nonbinary">Nonbinary</option></Select></Field>
      </div>
      <Field label="Brief" hint="A few lines. The director expands this into face, body and style notes."><Textarea value={spec.brief} onChange={(e) => set({ brief: e.target.value })} placeholder="Late twenties, serene, editorial; soft features, dark hair worn tucked; elegant hands." /></Field>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Age"><Select value={spec.age_range} onChange={(e) => set({ age_range: e.target.value as TalentSpec["age_range"] })}>{["18-24", "25-34", "35-44", "45-60", "60+"].map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
        <Field label="Skin tone (Monk 1–10)" hint={MONK_WORDS[spec.skin_tone_monk]}><Select value={String(spec.skin_tone_monk)} onChange={(e) => set({ skin_tone_monk: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} — {MONK_WORDS[n]}</option>)}</Select></Field>
        <Field label="Undertone"><Select value={spec.undertone} onChange={(e) => set({ undertone: e.target.value as TalentSpec["undertone"] })}>{["warm", "cool", "neutral", "olive"].map((u) => <option key={u} value={u}>{humanize(u)}</option>)}</Select></Field>
        <Field label="Heritage notes (optional)"><Input value={spec.heritage_notes ?? ""} onChange={(e) => set({ heritage_notes: e.target.value || undefined })} /></Field>
        <Field label="Hair length"><Select value={spec.hair.length} onChange={(e) => set({ hair: { ...spec.hair, length: e.target.value as TalentSpec["hair"]["length"] } })}>{["cropped", "short", "bob", "shoulder", "long"].map((u) => <option key={u} value={u}>{humanize(u)}</option>)}</Select></Field>
        <Field label="Hair texture"><Select value={spec.hair.texture} onChange={(e) => set({ hair: { ...spec.hair, texture: e.target.value as TalentSpec["hair"]["texture"] } })}>{["straight", "wavy", "curly", "coily"].map((u) => <option key={u} value={u}>{humanize(u)}</option>)}</Select></Field>
        <Field label="Hair color"><Input value={spec.hair.color} onChange={(e) => set({ hair: { ...spec.hair, color: e.target.value } })} /></Field>
        <Field label="Hair state (default)"><Select value={spec.hair.default_state} onChange={(e) => set({ hair: { ...spec.hair, default_state: e.target.value as TalentSpec["hair"]["default_state"] } })}>{HAIR_STATES.map((u) => <option key={u} value={u}>{humanize(u)}</option>)}</Select></Field>
        <Field label="Nails"><Select value={spec.hands.nails} onChange={(e) => set({ hands: { ...spec.hands, nails: e.target.value as TalentSpec["hands"]["nails"] } })}>{NAILS.map((u) => <option key={u} value={u}>{humanize(u)}</option>)}</Select></Field>
        <Field label="Other ear piercings"><Select value={spec.ears.other_piercings} onChange={(e) => set({ ears: { ...spec.ears, other_piercings: e.target.value as TalentSpec["ears"]["other_piercings"] } })}>{["none", "single", "stack"].map((u) => <option key={u} value={u}>{humanize(u)}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Face notes" hint="Filled by the director; edit freely"><Textarea value={spec.face_notes} onChange={(e) => set({ face_notes: e.target.value })} /></Field>
        <Field label="Body"><Textarea value={spec.body} onChange={(e) => set({ body: e.target.value })} /></Field>
      </div>
    </div>
  );
}
