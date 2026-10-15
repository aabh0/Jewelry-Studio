"use client";
import * as React from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Chip } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/controls";
import { LightingEditor } from "./lighting-editor";
import { SHOT_FORMATS, BODY_CROPS, ASPECTS, QA_FOCUS, humanize } from "@/domain/taxonomy";
import { LENSES, APERTURES, SHOT_SIZES, ANGLES, LIGHTING_PRESETS, lightingFromPreset, type SceneSpec, type CameraSpec } from "@/domain/lighting";
import { CAMERA_MOVES, type ShotSpec } from "@/domain/storyboard";
import { VIDEO_PRESETS } from "@/domain/prompt/templates/higgsfield-masters";
import type { ProductLite, TalentLite } from "./project-cards";

export function ShotEditor({ title, spec, onChange, products, talent, isVideo }: { title: string; spec: ShotSpec; onChange: (v: { title: string; spec: ShotSpec }) => void; products: ProductLite[]; talent: TalentLite[]; isVideo: boolean }) {
  const set = (patch: Partial<ShotSpec>) => onChange({ title, spec: { ...spec, ...patch } });
  const setCam = (patch: Partial<CameraSpec>) => set({ camera: { ...spec.camera, ...patch } });
  const setScene = (patch: Partial<SceneSpec>) => set({ scene: { ...spec.scene, ...patch } });
  const selTalent = talent.find((t) => t.id === spec.talent_id);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Title"><Input value={title} onChange={(e) => onChange({ title: e.target.value, spec })} /></Field>
        <Field label="Priority"><Select value={String(spec.priority)} onChange={(e) => set({ priority: Number(e.target.value) as 1 })}><option value="1">1 · must</option><option value="2">2 · should</option><option value="3">3 · nice</option></Select></Field>
      </div>
      <Field label={isVideo ? "What this keyframe shows" : "Purpose"}><Textarea rows={2} value={spec.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder="Hero still of the ring at three-quarter, stone sharp, warm but neutral metal." /></Field>
      <Tabs defaultValue="subject">
        <TabsList>
          <TabsTrigger value="subject">Subject</TabsTrigger>
          <TabsTrigger value="light">Lighting</TabsTrigger>
          <TabsTrigger value="camera">Camera &amp; scene</TabsTrigger>
          {isVideo ? <TabsTrigger value="motion">Motion</TabsTrigger> : null}
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        <TabsContent value="subject" className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Format"><Select value={spec.format} onChange={(e) => set({ format: e.target.value as ShotSpec["format"] })}>{SHOT_FORMATS.map((f) => <option key={f} value={f}>{humanize(f)}</option>)}</Select></Field>
            <Field label="Body crop" hint="For on-model formats"><Select value={spec.crop ?? ""} onChange={(e) => set({ crop: (e.target.value || undefined) as ShotSpec["crop"] })}><option value="">—</option>{BODY_CROPS.map((f) => <option key={f} value={f}>{humanize(f)}</option>)}</Select></Field>
          </div>
          <Field label="Products in frame"><div className="flex flex-wrap gap-1.5">{products.map((p) => <Chip key={p.id} active={spec.product_ids.includes(p.id)} onClick={() => set({ product_ids: spec.product_ids.includes(p.id) ? spec.product_ids.filter((x) => x !== p.id) : [...spec.product_ids, p.id] })}>{p.name}</Chip>)}</div></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Person"><Select value={spec.talent_id ?? ""} onChange={(e) => set({ talent_id: e.target.value || undefined, outfit_id: undefined })}><option value="">{["on_model_beauty_crop", "hand_model", "couples_gifting", "social_ugc_tryon", "lifestyle_editorial"].includes(spec.format) ? "Campaign person" : "None (product only)"}</option>{talent.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
            <Field label="Outfit"><Select value={spec.outfit_id ?? ""} disabled={!selTalent} onChange={(e) => set({ outfit_id: e.target.value || undefined })}><option value="">Campaign default</option>{(selTalent?.outfits ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Aspect"><Select value={spec.aspect} onChange={(e) => set({ aspect: e.target.value as ShotSpec["aspect"] })}>{ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
            <Field label="Variants"><Input type="number" min={1} max={8} value={spec.variants} onChange={(e) => set({ variants: Math.min(8, Math.max(1, Number(e.target.value) || 1)) })} /></Field>
          </div>
        </TabsContent>
        <TabsContent value="light" className="pt-4 space-y-4">
          <Field label="Start from preset"><div className="flex flex-wrap gap-1.5">{Object.entries(LIGHTING_PRESETS).map(([k, p]) => <Chip key={k} onClick={() => set({ lighting: lightingFromPreset(k) })} title={p.description}>{p.name}</Chip>)}</div></Field>
          <LightingEditor value={spec.lighting} onChange={(l) => set({ lighting: l })} compact />
        </TabsContent>
        <TabsContent value="camera" className="pt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Lens"><Select value={String(spec.camera.lens_mm)} onChange={(e) => setCam({ lens_mm: Number(e.target.value) })}>{LENSES.map((l) => <option key={l} value={l}>{l} mm</option>)}</Select></Field>
            <Field label="Aperture"><Select value={spec.camera.aperture} onChange={(e) => setCam({ aperture: e.target.value as CameraSpec["aperture"] })}>{APERTURES.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
            <Field label="Shot size"><Select value={spec.camera.shot_size} onChange={(e) => setCam({ shot_size: e.target.value as CameraSpec["shot_size"] })}>{SHOT_SIZES.map((a) => <option key={a} value={a}>{a}</option>)}</Select></Field>
            <Field label="Angle"><Select value={spec.camera.angle} onChange={(e) => setCam({ angle: e.target.value as CameraSpec["angle"] })}>{ANGLES.map((a) => <option key={a} value={a}>{humanize(a)}</option>)}</Select></Field>
            <Field label="Focus"><Select value={spec.camera.focus} onChange={(e) => setCam({ focus: e.target.value as CameraSpec["focus"] })}><option value="product">Product</option><option value="face">Face</option><option value="rack">Rack focus</option></Select></Field>
            <Field label="Copy safe area"><Select value={spec.scene.copy_safe_area} onChange={(e) => setScene({ copy_safe_area: e.target.value as SceneSpec["copy_safe_area"] })}>{["none", "left", "right", "top", "bottom", "center"].map((a) => <option key={a} value={a}>{humanize(a)}</option>)}</Select></Field>
          </div>
          <Field label="Environment" hint="Leave empty for a studio set."><Input value={spec.scene.environment} onChange={(e) => setScene({ environment: e.target.value })} placeholder="a sunlit stone windowsill" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Props" hint="comma separated"><Input value={spec.scene.props.join(", ")} onChange={(e) => setScene({ props: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></Field>
            <Field label="Season"><Input value={spec.scene.season ?? ""} onChange={(e) => setScene({ season: e.target.value || undefined })} /></Field>
            <Field label="Time of day"><Input value={spec.scene.time_of_day ?? ""} onChange={(e) => setScene({ time_of_day: e.target.value || undefined })} /></Field>
          </div>
        </TabsContent>
        {isVideo ? (
          <TabsContent value="motion" className="pt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Duration (s)"><Input type="number" min={2} max={8} step={0.5} value={spec.duration_s ?? 4} onChange={(e) => set({ duration_s: Math.min(15, Math.max(2, Number(e.target.value) || 2)) })} /></Field>
              <Field label="Camera move"><Select value={spec.camera_move ?? "static"} onChange={(e) => set({ camera_move: e.target.value })}>{CAMERA_MOVES.map((m) => <option key={m} value={m}>{humanize(m)}</option>)}</Select></Field>
              <Field label="Speed"><Select value={spec.move_speed ?? "slow"} onChange={(e) => set({ move_speed: e.target.value as "slow" })}><option value="slow">Slow</option><option value="medium">Medium</option></Select></Field>
            </div>
            <Field label="Subject action" hint="What moves. One thing."><Input value={spec.subject_action ?? ""} onChange={(e) => set({ subject_action: e.target.value || undefined })} placeholder="hand turns slowly so the stone catches the light" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Product visibility"><Select value={spec.product_visibility ?? "full"} onChange={(e) => set({ product_visibility: e.target.value as "full" })}><option value="full">Full</option><option value="partial">Partial</option><option value="reveal">Reveal</option></Select></Field>
              <Field label="Transition in"><Select value={spec.transition_in ?? "cut"} onChange={(e) => set({ transition_in: e.target.value as "cut" })}>{["cut", "dissolve", "match_cut", "whip", "light_flare", "fade"].map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select></Field>
              <Field label="Transition out"><Select value={spec.transition_out ?? "cut"} onChange={(e) => set({ transition_out: e.target.value as "cut" })}>{["cut", "dissolve", "match_cut", "whip", "light_flare", "fade"].map((t) => <option key={t} value={t}>{humanize(t)}</option>)}</Select></Field>
            </div>
            <Field label="Product video preset" hint="Overrides the camera move with a proven Higgsfield product recipe."><Select value={spec.preset_move ?? ""} onChange={(e) => set({ preset_move: e.target.value || undefined })}><option value="">None — use camera move above</option>{Object.entries(VIDEO_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</Select></Field>
            <Field label="Motion prompt hint"><Textarea rows={2} value={spec.video_prompt_hint ?? ""} onChange={(e) => set({ video_prompt_hint: e.target.value || undefined })} /></Field>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
              <Field label="Text overlay"><Input value={spec.text_overlay?.copy ?? ""} onChange={(e) => set({ text_overlay: e.target.value ? { copy: e.target.value, position: spec.text_overlay?.position ?? "bottom", in_s: spec.text_overlay?.in_s ?? 0.5, out_s: spec.text_overlay?.out_s ?? 2.5 } : undefined })} placeholder="Optional on-screen copy" /></Field>
              <Field label="Position"><Select value={spec.text_overlay?.position ?? "bottom"} disabled={!spec.text_overlay} onChange={(e) => spec.text_overlay && set({ text_overlay: { ...spec.text_overlay, position: e.target.value as "bottom" } })}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></Select></Field>
              <Field label="In (s)"><Input type="number" step={0.1} className="w-20" value={spec.text_overlay?.in_s ?? 0.5} disabled={!spec.text_overlay} onChange={(e) => spec.text_overlay && set({ text_overlay: { ...spec.text_overlay, in_s: Number(e.target.value) } })} /></Field>
              <Field label="Out (s)"><Input type="number" step={0.1} className="w-20" value={spec.text_overlay?.out_s ?? 2.5} disabled={!spec.text_overlay} onChange={(e) => spec.text_overlay && set({ text_overlay: { ...spec.text_overlay, out_s: Number(e.target.value) } })} /></Field>
            </div>
          </TabsContent>
        ) : null}
        <TabsContent value="advanced" className="pt-4 space-y-4">
          <Field label="Free text" hint="Appended to the DIRECTION block."><Textarea rows={2} value={spec.free_text ?? ""} onChange={(e) => set({ free_text: e.target.value || undefined })} /></Field>
          <Field label="QA focus" hint="Extra checks for this shot."><div className="flex flex-wrap gap-1.5">{QA_FOCUS.map((f) => <Chip key={f} active={spec.qa_focus.includes(f)} onClick={() => set({ qa_focus: spec.qa_focus.includes(f) ? spec.qa_focus.filter((x) => x !== f) : [...spec.qa_focus, f] })}>{humanize(f)}</Chip>)}</div></Field>
          <Field label="Prompt override" hint="Replaces the compiled prompt entirely. Invariants are still appended."><Textarea rows={4} value={spec.prompt_override ?? ""} onChange={(e) => set({ prompt_override: e.target.value || undefined })} /></Field>
        </TabsContent>
      </Tabs>
    </div>
  );
}
