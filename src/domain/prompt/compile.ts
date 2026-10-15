import type { ProductSpec } from "../product";
import { describeProduct, describeWear, normalizeProductSpec, materialProfile } from "../product";
import type { TalentSpec, OutfitSpec } from "../talent";
import { describeTalent, describeOutfit } from "../talent";
import type { LightingSpec, CameraSpec, SceneSpec } from "../lighting";
import { describeLighting, describeBackground, applyMaterialRules } from "../lighting";
import type { ShotSpec, StoryboardShot } from "../storyboard";
import { buildNegative } from "./negatives";
import { HERO_SHOT, LUXURY, IN_HAND, START_FRAME, CLEAN_PLATE_BG, VIDEO_PRESETS } from "./templates/higgsfield-masters";
import { humanize } from "../taxonomy";

export const COMPILER_VERSION = 3;

export type ReferenceRoleKind = "product_primary" | "product_angle" | "product_macro" | "product_sheet" | "talent_identity" | "talent_hands" | "talent_ear" | "talent_neck" | "outfit" | "style" | "composition" | "source_image" | "mask_preview";

export interface ReferenceRole {
  asset_id: string;
  role: ReferenceRoleKind;
  label?: string;
}

export interface CompileInput {
  shot: ShotSpec;
  products: { id: string; name: string; spec: ProductSpec; invariants: string[]; learnedAvoids?: string[] }[];
  talent?: { id: string; name: string; spec: TalentSpec; outfit?: OutfitSpec };
  references: ReferenceRole[];
  target: { model: string; lane: "cloud" | "cli" | "local"; resolution: "1k" | "2k" | "4k" };
  brief?: { tone?: string[]; must_include?: string[]; must_avoid?: string[]; occasion?: string };
}

export interface PromptBundle {
  prompt_text: string;
  negative_text: string;
  sections: Record<string, string>;
  references: ReferenceRole[];
  compiler_version: number;
  warnings: string[];
  lighting_effective: LightingSpec;
}

const SHOT_SIZE_WORDS: Record<CameraSpec["shot_size"], string> = { ECU: "extreme close-up", CU: "close-up", MCU: "medium close-up", MS: "medium shot", MLS: "medium-long shot", WS: "wide shot" };
const ANGLE_WORDS: Record<CameraSpec["angle"], string> = { eye_level: "at product eye level", high: "from a high angle", low: "from a low hero angle", top_down: "straight top-down", three_quarter_45: "from a 45° three-quarter angle" };
const APERTURE_DOF: Record<CameraSpec["aperture"], string> = { "f1.4": "extremely shallow depth of field with creamy bokeh", f2: "shallow depth of field", "f2.8": "shallow depth of field, classic separation", f4: "controlled depth of field", "f5.6": "moderate depth of field with context readable", f8: "deep enough depth of field for the whole piece to be sharp", f11: "deep depth of field, tack-sharp from front to back", f16: "everything sharp" };

function referenceSentences(refs: ReferenceRole[], talentName?: string): string {
  if (refs.length === 0) return "";
  const lines: string[] = [];
  refs.forEach((r, i) => {
    const n = i + 1;
    switch (r.role) {
      case "product_primary": lines.push(`Image ${n} is the authoritative product reference; match it exactly.`); break;
      case "product_angle": lines.push(`Image ${n} shows the same product from another angle.`); break;
      case "product_macro": lines.push(`Image ${n} is a macro of the product's stone and setting detail.`); break;
      case "product_sheet": lines.push(`Image ${n} is a clean reference view of the same product.`); break;
      case "talent_identity": lines.push(`Image ${n} is the identity reference for ${talentName ?? "the talent"}: same original person, same face, hair and skin tone.`); break;
      case "talent_hands": lines.push(`Image ${n} shows ${talentName ?? "the talent"}'s hands and nails.`); break;
      case "talent_ear": lines.push(`Image ${n} shows ${talentName ?? "the talent"}'s ear and profile.`); break;
      case "talent_neck": lines.push(`Image ${n} shows ${talentName ?? "the talent"}'s neck and décolletage.`); break;
      case "outfit": lines.push(`Image ${n} is the wardrobe reference.`); break;
      case "style": lines.push(`Image ${n} is a style and mood reference only (palette, light, composition); do not copy its product or people.`); break;
      case "composition": lines.push(`Image ${n} is a composition reference only.`); break;
      case "source_image": lines.push(`Image ${n} is the source image to edit; keep everything not mentioned identical.`); break;
      case "mask_preview": lines.push(`Image ${n} is the same source with the editable region outlined in red; change only that region.`); break;
    }
  });
  return lines.join(" ");
}

function formatSentence(shot: ShotSpec, aspect: string, res: string): string {
  const f = humanize(shot.format).toLowerCase();
  const crop = shot.crop ? ` (${shot.crop.replace(/_/g, " ")} crop)` : "";
  const channels = shot.channels.length ? ` for ${shot.channels.join(", ")}` : "";
  return `${f[0].toUpperCase()}${f.slice(1)}${crop}${channels}, ${aspect} aspect, ${res} resolution.`;
}

function compositionSentence(shot: ShotSpec, cam: CameraSpec, scene: SceneSpec): string {
  const share = shot.format === "macro_detail" ? "the product fills most of the frame" : shot.format === "lifestyle_editorial" ? "the product stays clearly legible and is the focal anchor even if small" : shot.format === "on_model_beauty_crop" || shot.format === "hand_model" ? "the product occupies 40–60% of the frame and is the visual anchor; the person is partial context" : "the product is the hero of the frame with generous negative space";
  const copy = scene.copy_safe_area !== "none" ? ` Leave a calm, tonally quiet area on the ${scene.copy_safe_area} for copy, blended naturally into the scene (no flat band).` : "";
  return `${SHOT_SIZE_WORDS[cam.shot_size][0].toUpperCase()}${SHOT_SIZE_WORDS[cam.shot_size].slice(1)} ${ANGLE_WORDS[cam.angle]}; ${share}; rule-of-thirds placement unless a symmetric hero composition is intended.${copy}`;
}

function cameraSentence(cam: CameraSpec, focusTarget: string): string {
  const focus = cam.focus === "rack" ? "rack focus from product to face" : cam.focus === "face" ? "focus on the face with the product sharp" : `sharp focus on ${focusTarget}`;
  return `Shot on a ${cam.lens_mm} mm ${cam.lens_mm >= 100 ? "macro " : ""}lens at ${cam.aperture.replace("f", "f/")}, ${APERTURE_DOF[cam.aperture]}, ${focus}, tripod-steady.`;
}

function sceneSentence(l: LightingSpec, scene: SceneSpec, occasion?: string): string {
  const parts = [`Background: ${describeBackground(l)}.`];
  if (scene.environment) parts.push(`Environment: ${scene.environment}.`);
  if (scene.props.length) parts.push(`Props: ${scene.props.join(", ")}, arranged to support the story without clutter.`);
  if (scene.time_of_day) parts.push(`Time of day: ${scene.time_of_day}.`);
  if (occasion && occasion !== "none") parts.push(`Occasion: ${humanize(occasion).toLowerCase()}.`);
  return parts.join(" ");
}

export function compilePrompt(input: CompileInput): PromptBundle {
  const { shot, products, talent, references, target } = input;
  const warnings: string[] = [];
  const primary = products[0];
  const people = !!talent || ["on_model_beauty_crop", "hand_model", "couples_gifting", "social_ugc_tryon", "lifestyle_editorial"].includes(shot.format);
  const { lighting, notes } = primary ? applyMaterialRules(shot.lighting, primary.spec) : { lighting: shot.lighting, notes: [] };
  warnings.push(...notes);
  const sections: Record<string, string> = {};

  sections.FORMAT = formatSentence(shot, shot.aspect, target.resolution);

  const productLines: string[] = [];
  for (const p of products) {
    const spec = normalizeProductSpec(p.spec);
    productLines.push(`${products.length > 1 ? `${p.name}: ` : ""}${describeProduct(spec)}`);
    productLines.push(`Invariants: ${p.invariants.join("; ")}.`);
  }
  productLines.push("No added stones, no text, no logo, no hallmark beyond what is listed.");
  const refText = referenceSentences(references, talent?.name);
  if (refText) productLines.push(refText);
  sections.PRODUCT = `[PRODUCT — must match reference images exactly] ${productLines.join(" ")}`;

  if (primary) sections.WEAR = `[WEAR / PLACEMENT] ${describeWear(primary.spec)}`;

  if (talent) {
    const t = talent.spec;
    const hair = shot.crop === "ear" || primary?.spec.category === "earring" ? "hair tucked behind the ear so the lobe is fully visible" : `hair ${t.hair.default_state.replace(/_/g, " ")}`;
    const nails = `${t.hands.nails.replace(/_/g, " ")} nails, smooth well-kept hands`;
    const identity = references.some((r) => r.role === "talent_identity") ? `Identical original character shown in the identity reference image(s) (${talent.name}); keep face, hair, skin tone and nails locked; ${nails}.` : `An original character (${talent.name}): ${describeTalent(t)}.`;
    const outfit = talent.outfit ? ` Wardrobe: ${describeOutfit(talent.outfit)}.` : " Wardrobe: simple, matte, neutral and elegant, no logos.";
    const realism = "Visible fine skin texture with natural pores and subtle asymmetry, natural visible makeup, no beauty filter, no AI-airbrushed look, matte-to-natural complexion, mature adult structure.";
    const gesture = shot.free_text ? "" : shot.crop === "hand" || shot.crop === "wrist" ? " Hand relaxed with fingers loosely curled, palm turned slightly toward camera, hand tilted up so the fingers do not foreshorten; the jewelry is never covered by fingers." : shot.crop === "neck" || shot.crop === "decolletage" ? " Chin visible, collarbones lit, calm expression, eyes soft." : "";
    sections.TALENT = `[TALENT] ${identity} ${hair}.${outfit} ${realism}${gesture}`;
  }

  sections.COMPOSITION = `[COMPOSITION] ${compositionSentence(shot, shot.camera, shot.scene)}`;
  sections.LIGHTING = `[LIGHTING] ${describeLighting(lighting)}`;
  sections.CAMERA = `[CAMERA] ${cameraSentence(shot.camera, primary ? "the product's stone and metal edges" : "the subject")}`;
  sections.SCENE = `[SCENE] ${sceneSentence(lighting, shot.scene, input.brief?.occasion)}`;
  if (shot.free_text) sections.DIRECTION = `[DIRECTION] ${shot.free_text.trim()}`;
  if (shot.purpose) sections.PURPOSE = `[PURPOSE] ${shot.purpose.trim()}`;
  const tone = input.brief?.tone?.length ? ` Tone: ${input.brief.tone.join(", ")}.` : "";
  sections.STYLE = `[STYLE] Commercial jewelry photography, magazine editorial standard, refined and restrained, true-to-life materials.${tone}`;
  sections.QUALITY = `[QUALITY] Tack-sharp facets, true metal color, realistic micro-reflections, hyper-detailed, photorealistic, no AI artifacts.`;
  const learned = products.flatMap((p) => p.learnedAvoids ?? []).slice(0, 8);
  const mustAvoid = input.brief?.must_avoid ?? [];
  const negative = buildNegative({ people, text: true, stock: shot.format !== "packshot_white", learnedAvoids: [...learned, ...mustAvoid] });
  sections.AVOID = `[AVOID] ${negative}.`;

  let master = "";
  if (shot.format === "hero_still_life") master = lighting.mood === "low_key" ? LUXURY : HERO_SHOT;
  if (shot.format === "hand_model" && !talent) master = IN_HAND;
  const order = ["FORMAT", "PRODUCT", "WEAR", "TALENT", "COMPOSITION", "LIGHTING", "CAMERA", "SCENE", "DIRECTION", "PURPOSE", "STYLE", "QUALITY", "AVOID"];
  const isGpt = target.model.includes("marketing-studio") || target.model.startsWith("gpt_image");
  const limit = isGpt ? 4800 : 6000;
  const tail = isGpt ? `\n\nresolution: ${target.resolution}` : "";
  let prompt_text: string;
  if (shot.prompt_override && shot.prompt_override.trim()) {
    prompt_text = shot.prompt_override.trim();
  } else {
    const assemble = (avoid: string) => {
      const secs: Record<string, string> = { ...sections, AVOID: avoid };
      const b = order.filter((k) => secs[k]).map((k) => secs[k]).join("\n\n");
      return master ? `${master}\n\n${b}` : b;
    };
    prompt_text = assemble(sections.AVOID);
    if (prompt_text.length + tail.length > limit) {
      // Shorten the AVOID block first (jewelry negatives are the ones that matter), then the master prompt.
      const short = `[AVOID] ${buildNegative({ people, learnedAvoids: [...learned, ...mustAvoid] })}.`;
      prompt_text = assemble(short);
      warnings.push("Negative block shortened to fit the model's prompt limit.");
      if (prompt_text.length + tail.length > limit && master) {
        master = "";
        prompt_text = assemble(short);
        warnings.push("Master prompt dropped to fit the model's prompt limit.");
      }
      if (prompt_text.length + tail.length > limit) {
        prompt_text = prompt_text.slice(0, limit - tail.length);
        warnings.push("Prompt truncated to the model's limit.");
      }
    }
  }
  if (target.model.includes("qwen")) prompt_text = prompt_text.replace(/\n\n\[AVOID\][^\n]*/g, "");
  prompt_text += tail;
  return { prompt_text, negative_text: negative, sections, references, compiler_version: COMPILER_VERSION, warnings, lighting_effective: lighting };
}

/** Clean plate / product sheet prompts. */
export function compileCleanPlate(view: "hero" | "front" | "profile" | "macro" | "plate", product: { spec: ProductSpec; invariants: string[] }): string {
  const base = START_FRAME(CLEAN_PLATE_BG);
  const viewText: Record<typeof view, string> = {
    plate: "Show the product from the same viewpoint as the reference, straightened and level.",
    hero: "Show the product at a 45° three-quarter hero angle with a slight low camera, the whole piece in crisp focus.",
    front: "Show the product straight-on from the front, level with the camera.",
    profile: "Show the product in exact side profile.",
    macro: "Show a top-down macro of the primary stone and setting, filling the frame, every prong and facet sharp.",
  };
  return `${base} ${viewText[view]} ${describeProduct(product.spec)} Invariants: ${product.invariants.join("; ")}. ${buildNegative({ text: true })}.\n\nresolution: 2k`;
}

/** Refinement prompt: keep identical, change one thing. */
export function compileRefine(instruction: string, product?: { spec: ProductSpec; invariants: string[] }): string {
  const inv = product ? ` Preserve the product exactly: ${product.invariants.join("; ")}.` : "";
  return `Refine the previous image (image 1). Keep composition, subject, framing, lighting and overall scene IDENTICAL. Only change: ${instruction.trim()}.${inv} Deliver a photorealistic, production-ready image. ${buildNegative({ people: true, text: true })}.\n\nresolution: 2k`;
}

export function compileRelight(lighting: LightingSpec, product?: { spec: ProductSpec; invariants: string[] }): string {
  const inv = product ? ` Preserve the product exactly: ${product.invariants.join("; ")}.` : "";
  return `Relight the previous image (image 1). Keep composition, subject, framing, pose and every object IDENTICAL; change only the lighting and the resulting shadows, highlights and reflections. New lighting: ${describeLighting(lighting)} Background mood: ${describeBackground(lighting)}.${inv} ${buildNegative({ people: true, text: true })}.\n\nresolution: 2k`;
}

export function compileInpaint(instruction: string, product?: { spec: ProductSpec; invariants: string[] }): string {
  const inv = product ? ` The product must stay exactly as described: ${product.invariants.join("; ")}.` : "";
  return `Edit image 1. Image 2 is the same image with the editable region outlined in red. Change ONLY the region inside the red outline: ${instruction.trim()}. Everything outside the outline must remain pixel-identical: same composition, lighting, colors and objects. Do not draw the red outline.${inv} ${buildNegative({ people: true, text: true })}.\n\nresolution: 2k`;
}

export function compileOutpaint(aspect: string, sceneHint?: string): string {
  return `Image 1 is a photo whose borders have been padded with a soft blurred mirror of itself to reach a ${aspect} frame. Replace the blurred border areas with a natural, seamless continuation of the real scene (surface, background, lighting direction and perspective continue exactly)${sceneHint ? `: ${sceneHint}` : ""}. The original central photo must remain pixel-identical: do not alter the product, people, or anything inside it. ${buildNegative({ people: true, text: true, stock: true })}.\n\nresolution: 2k`;
}

export function compileUpscaleRerender(): string {
  return `Re-render image 1 at the highest possible resolution with no changes: identical composition, framing, lighting, colors, product geometry, stones, prongs, chain links and text. Only add genuine fine detail and sharpness; do not restyle, repaint, re-imagine or move anything. ${buildNegative({ people: true, text: true })}.\n\nresolution: 4k`;
}

/** Character sheet prompts (slot architecture from Higgsfield's character-sheet workflow). */
export function compileCharacterSheet(kind: "split" | "turnaround" | "expressions" | "hands_ears_neck" | "outfit", t: TalentSpec, name: string, outfit?: OutfitSpec, hasIdentityRef = false): string {
  const identity = hasIdentityRef ? `identical original character to the reference image (${name}) on all views` : `identical original character (${name}) on all views`;
  const comp: Record<typeof kind, string> = {
    split: "Split-screen character sheet composition, left side a full-body shot of the character standing upright in a neutral straight standing pose facing the camera with both feet flat on the ground and arms relaxed at the sides, full head-to-toe framing with the whole body and both feet visible, right side a tight close-up chest-up portrait of the same character,",
    turnaround: "Character turnaround model sheet, four consistent full-body views in a row — front view, 3/4 view, side profile, and back view, evenly spaced,",
    expressions: "Character expression sheet, one chest-up reference on the left and a grid of head-and-shoulders portraits on the right showing varied expressions (neutral, soft smile, serene, surprised),",
    hands_ears_neck: "Jewelry casting detail sheet, a 2x2 grid: top-left both hands relaxed on a neutral surface with nails visible, top-right left ear in exact profile with hair tucked back and lobe fully visible, bottom-left right ear in exact profile with hair tucked back, bottom-right neck and décolletage frontal from chin to upper chest with collarbones visible,",
    outfit: "Character wardrobe sheet, the same character shown full-body standing and chest-up side by side wearing the described outfit,",
  };
  const wardrobe = outfit ? describeOutfit(outfit) : "a simple matte neutral top, no bag, no logos";
  const realism = "visible fine skin texture with natural pores, fine lines, subtle asymmetries, natural visible makeup with slightly uneven blending rather than flawless coverage, slight natural sheen rather than glossy retouched finish, no digital smoothing, no beauty filter, no AI-airbrushed look, matte-to-natural complexion, naturally muted catchlights in the eyes with no oversized specular glare";
  return `${comp[kind]} ${identity}, single subject only exactly one person with only the character in frame, pure white seamless studio background, professional character sheet presentation, ${describeTalent(t)}, ${realism}, wearing ${wardrobe}, natural anatomy, high-end but unretouched commercial photography style, soft diffused studio lighting without harsh reflections, cinematic realism, clean white background, 4K quality, sharp focus on skin texture detail, no other people, no duplicate figures, no mannequin, no props, no furniture, no background objects, no text, no watermark, no logos, no frame borders, no babyface, no overly youthful rounded proportions, no plastic skin, no glossy skin.\n\nresolution: 2k`;
}

/** Video prompt for a storyboard shot. */
export function compileVideoPrompt(shot: StoryboardShot, product: { spec: ProductSpec; invariants: string[] } | undefined, talentName?: string, maxChars = 1400): string {
  const move = humanize(shot.camera_move).toLowerCase();
  const lighting = product ? applyMaterialRules(shot.lighting, product.spec, { video: true }).lighting : shot.lighting;
  const parts = [
    `[SHOT] ${shot.duration_s}-second ${SHOT_SIZE_WORDS[shot.shot_size]} ${ANGLE_WORDS[shot.angle]}, one ${shot.move_speed} ${move} and nothing else.`,
    `[ACTION] ${shot.subject_action}${talentName ? ` (${talentName}, identical to the identity reference)` : ""}.`,
    product ? `[PRODUCT] ${product.invariants.join("; ")}; product visible ${shot.product_placement.visibility === "reveal" ? "revealed during the shot" : shot.product_placement.visibility === "partial" ? "partially" : "in every frame"}, matching the reference exactly in every frame.` : "",
    `[LIGHTING] ${describeLighting(lighting, { video: true })}`,
    `[SCENE] ${describeBackground(lighting)}${shot.scene.environment ? `; ${shot.scene.environment}` : ""}.`,
    `[MOTION RULES] Motion physically plausible, temporal consistency high, edges stable, lighting static; do not morph, melt, duplicate or redesign the product; no new objects appear.`,
    `[AUDIO] Silent.`,
    `[END] End on a clean, stable frame.`,
    shot.video_prompt_hint ? `[DIRECTION] ${shot.video_prompt_hint}` : "",
  ].filter(Boolean);
  let text = parts.join(" ");
  if (text.length > maxChars) text = text.slice(0, maxChars);
  return text;
}

export function compilePresetVideo(presetId: string, durationS: number): string | null {
  const p = VIDEO_PRESETS[presetId];
  return p ? p.prompt(durationS) : null;
}

export function peopleInShot(shot: ShotSpec, hasTalent: boolean): boolean {
  return hasTalent || ["on_model_beauty_crop", "hand_model", "couples_gifting", "social_ugc_tryon", "lifestyle_editorial"].includes(shot.format);
}

export { materialProfile };
