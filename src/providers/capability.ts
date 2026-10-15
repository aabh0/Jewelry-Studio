import { env } from "@/env";
import { cloudClient } from "./higgsfield/cloud/client";
import { findCli, authState, type CliAuthState } from "./higgsfield/cli/adapter";
import { claudeAvailable } from "./claude/client";

export type LaneId = "cloud" | "cli" | "local" | "claude";

export type CapabilityId =
  | "image.generate.product"
  | "image.generate.person"
  | "image.generate.scene"
  | "image.character_sheet"
  | "image.product_sheet"
  | "image.edit.refine"
  | "image.edit.inpaint"
  | "image.edit.outpaint"
  | "image.edit.relight"
  | "image.cutout"
  | "image.clean_plate"
  | "image.upscale"
  | "video.generate.i2v"
  | "video.generate.r2v"
  | "video.generate.flf"
  | "video.generate.product_preset"
  | "video.edit.extend"
  | "video.edit.object_swap"
  | "video.edit.reframe"
  | "video.upscale"
  | "video.cutout"
  | "talent.identity.train"
  | "director"
  | "qa.vision";

export interface Implementation {
  id: string; // unique within capability
  lane: LaneId;
  model: string; // endpoint id (cloud) | job_set_type (cli) | local tool name
  label: string;
  degraded?: string; // one-line note when this is a fallback
  maxRefs?: number;
}

export interface CapabilityDef {
  id: CapabilityId;
  label: string;
  implementations: Implementation[];
  optional?: boolean; // may be unavailable in API-only mode
}

export const CAPABILITIES: CapabilityDef[] = [
  { id: "image.generate.product", label: "Product still", implementations: [
    { id: "cli.gpt25", lane: "cli", model: "gpt_image_2_5", label: "GPT Image 2.5 (CLI)", maxRefs: 16 },
    { id: "cloud.flare", lane: "cloud", model: "marketing-studio/image/flare", label: "GPT Image 2.5 Flare (Cloud)", maxRefs: 16 },
    { id: "cli.nanobanana", lane: "cli", model: "nano_banana_2", label: "Nano Banana Pro (CLI)", maxRefs: 14 },
    { id: "cli.seedream", lane: "cli", model: "seedream_v4_5", label: "Seedream 4.5 (CLI)", maxRefs: 14 },
  ] },
  { id: "image.generate.person", label: "Talent still", implementations: [
    { id: "cli.soul", lane: "cli", model: "text2image_soul_v2", label: "Soul V2 with Soul ID (CLI)", maxRefs: 1 },
    { id: "cli.gpt25", lane: "cli", model: "gpt_image_2_5", label: "GPT Image 2.5 with reference pack (CLI)", maxRefs: 16 },
    { id: "cloud.flare", lane: "cloud", model: "marketing-studio/image/flare", label: "GPT Image 2.5 Flare with reference pack (Cloud)", maxRefs: 16 },
  ] },
  { id: "image.generate.scene", label: "Scene plate", implementations: [
    { id: "cloud.ms", lane: "cloud", model: "marketing-studio/image", label: "Marketing Studio Image (Cloud)", maxRefs: 16 },
    { id: "cli.nanobanana", lane: "cli", model: "nano_banana_2", label: "Nano Banana Pro (CLI)", maxRefs: 14 },
    { id: "cloud.soul", lane: "cloud", model: "higgsfield-ai/soul/v2/standard", label: "Soul 2 text-only (Cloud, cheapest)", maxRefs: 0 },
  ] },
  { id: "image.character_sheet", label: "Character sheet", implementations: [
    { id: "cli.gpt25", lane: "cli", model: "gpt_image_2_5", label: "GPT Image 2.5 (CLI)", maxRefs: 16 },
    { id: "cloud.flare", lane: "cloud", model: "marketing-studio/image/flare", label: "GPT Image 2.5 Flare (Cloud)", maxRefs: 16 },
  ] },
  { id: "image.product_sheet", label: "Product sheet", implementations: [
    { id: "cli.gpt25", lane: "cli", model: "gpt_image_2_5", label: "GPT Image 2.5 (CLI)", maxRefs: 16 },
    { id: "cloud.flare", lane: "cloud", model: "marketing-studio/image/flare", label: "GPT Image 2.5 Flare (Cloud)", maxRefs: 16 },
  ] },
  { id: "image.edit.refine", label: "Refine", implementations: [
    { id: "cloud.flare", lane: "cloud", model: "marketing-studio/image/flare", label: "GPT Image 2.5 Flare (Cloud)", maxRefs: 16 },
    { id: "cli.gpt25", lane: "cli", model: "gpt_image_2_5", label: "GPT Image 2.5 (CLI)", maxRefs: 16 },
    { id: "cloud.qwen", lane: "cloud", model: "alibaba/qwen-image-3/edit", label: "Qwen Image 3 Edit (Cloud)", maxRefs: 3 },
  ] },
  { id: "image.edit.inpaint", label: "Inpaint", implementations: [
    { id: "cli.gpt2mask", lane: "cli", model: "gpt_image_2", label: "GPT Image 2 mask inpaint (CLI)", maxRefs: 1 },
    { id: "local.composite", lane: "local", model: "mask_composite", label: "Refine + local mask composite", degraded: "Using GPT Image 2.5 refine with local mask compositing; log in to the Higgsfield CLI for native mask inpainting." },
  ] },
  { id: "image.edit.outpaint", label: "Outpaint", implementations: [
    { id: "cli.outpaint", lane: "cli", model: "outpaint", label: "Outpaint (CLI)", maxRefs: 1 },
    { id: "local.pad", lane: "local", model: "pad_refine", label: "Pad + refine + center composite", degraded: "Using padded refine; log in to the Higgsfield CLI for native outpainting." },
  ] },
  { id: "image.edit.relight", label: "Relight", implementations: [
    { id: "cloud.flare", lane: "cloud", model: "marketing-studio/image/flare", label: "GPT Image 2.5 Flare relight (Cloud)", maxRefs: 16 },
    { id: "cli.gpt25", lane: "cli", model: "gpt_image_2_5", label: "GPT Image 2.5 relight (CLI)", maxRefs: 16 },
  ] },
  { id: "image.cutout", label: "Cutout", optional: true, implementations: [
    { id: "cli.bgremove", lane: "cli", model: "image_background_remover", label: "Background remover (CLI)", maxRefs: 1 },
  ] },
  { id: "image.clean_plate", label: "Clean plate", implementations: [
    { id: "cli.gpt25", lane: "cli", model: "gpt_image_2_5", label: "GPT Image 2.5 clean plate (CLI)", maxRefs: 16 },
    { id: "cloud.flare", lane: "cloud", model: "marketing-studio/image/flare", label: "GPT Image 2.5 Flare clean plate (Cloud)", maxRefs: 16 },
  ] },
  { id: "image.upscale", label: "Upscale", implementations: [
    { id: "cli.topaz", lane: "cli", model: "topaz_image", label: "Topaz (CLI)", maxRefs: 1 },
    { id: "cli.bytedance", lane: "cli", model: "bytedance_image_upscale", label: "ByteDance upscale (CLI)", maxRefs: 1 },
    { id: "cloud.generative", lane: "cloud", model: "marketing-studio/image/flare", label: "Generative 4K re-render (Cloud) with fidelity gate", degraded: "Generative re-render at 4K with a similarity gate; log in to the Higgsfield CLI for Topaz upscaling." },
    { id: "local.lanczos", lane: "local", model: "lanczos", label: "Basic 2× (local)" },
  ] },
  { id: "video.generate.i2v", label: "Still to clip", implementations: [
    { id: "cloud.kling3pro", lane: "cloud", model: "kling-video/v3.0/pro/image-to-video", label: "Kling 3.0 Pro (Cloud)" },
    { id: "cloud.seedance20", lane: "cloud", model: "bytedance/seedance-2.0/image-to-video", label: "Seedance 2.0 up to 4K (Cloud)" },
    { id: "cloud.seedance25", lane: "cloud", model: "bytedance/seedance-2.5/image-to-video", label: "Seedance 2.5 720p (Cloud)" },
    { id: "cloud.kling3turbo", lane: "cloud", model: "kling-video/v3.0-turbo/image-to-video", label: "Kling 3.0 Turbo draft (Cloud)" },
    { id: "cli.kling3", lane: "cli", model: "kling3_0", label: "Kling 3.0 (CLI)" },
  ] },
  { id: "video.generate.r2v", label: "Reference to clip", implementations: [
    { id: "cloud.seedance25r", lane: "cloud", model: "bytedance/seedance-2.5/reference-to-video", label: "Seedance 2.5 reference (Cloud)", maxRefs: 30 },
    { id: "cloud.klingo3", lane: "cloud", model: "kling-video/o3/image-reference", label: "Kling O3 image reference (Cloud)", maxRefs: 4 },
    { id: "cloud.seedance20r", lane: "cloud", model: "bytedance/seedance-2.0/reference-to-video", label: "Seedance 2.0 reference 4K (Cloud)", maxRefs: 9 },
    { id: "cloud.minimax", lane: "cloud", model: "minimax/h3/reference-to-video", label: "MiniMax H3 reference (Cloud)", maxRefs: 9 },
  ] },
  { id: "video.generate.flf", label: "First to last frame", implementations: [
    { id: "cloud.klingo3flf", lane: "cloud", model: "kling-video/o3/first-last-frame", label: "Kling O3 first/last (Cloud)" },
    { id: "cloud.kling3pro", lane: "cloud", model: "kling-video/v3.0/pro/image-to-video", label: "Kling 3.0 Pro with end frame (Cloud)" },
  ] },
  { id: "video.generate.product_preset", label: "Product move preset", implementations: [
    { id: "cloud.seedance20", lane: "cloud", model: "bytedance/seedance-2.0/image-to-video", label: "Seedance 2.0 preset move (Cloud)" },
  ] },
  { id: "video.edit.extend", label: "Extend clip", implementations: [
    { id: "cloud.seedance25x", lane: "cloud", model: "bytedance/seedance-2.5/video-extend", label: "Seedance 2.5 extend (Cloud)" },
    { id: "local.lastframe", lane: "local", model: "continue_from_last_frame", label: "Continue from last frame + concat", degraded: "Continuation generated from the last frame and joined with a crossfade." },
  ] },
  { id: "video.edit.object_swap", label: "Object swap", implementations: [
    { id: "cloud.genjutsu", lane: "cloud", model: "higgsfield/genjutsu/object-swap/v1.0", label: "Genjutsu object swap (Cloud)", maxRefs: 8 },
    { id: "cloud.klingedit", lane: "cloud", model: "kling-video/o3/video-edit", label: "Kling O3 video edit (Cloud)", maxRefs: 4 },
  ] },
  { id: "video.edit.reframe", label: "Reframe", implementations: [
    { id: "cli.reframe", lane: "cli", model: "reframe", label: "Reframe workflow (CLI)" },
    { id: "local.ffmpeg", lane: "local", model: "ffmpeg_reframe", label: "Focal-point crop (local)", degraded: "Local crop with focal-point keyframes; log in to the Higgsfield CLI for generative reframing." },
  ] },
  { id: "video.upscale", label: "Video upscale", implementations: [
    { id: "cli.topazv", lane: "cli", model: "topaz_video", label: "Topaz video (CLI)" },
    { id: "cli.upscalev", lane: "cli", model: "video_upscale", label: "Video upscale (CLI)" },
    { id: "local.lanczos", lane: "local", model: "ffmpeg_lanczos", label: "Basic lanczos (local)", degraded: "Basic scaling only; log in to the Higgsfield CLI for Topaz video upscaling." },
  ] },
  { id: "video.cutout", label: "Video background removal", optional: true, implementations: [
    { id: "cli.vbgremove", lane: "cli", model: "video_background_remover", label: "Video background remover (CLI)" },
  ] },
  { id: "talent.identity.train", label: "Identity lock", implementations: [
    { id: "cli.soul", lane: "cli", model: "soul-id", label: "Soul ID training (CLI)" },
    { id: "local.refpack", lane: "local", model: "reference_pack", label: "Reference pack identity", degraded: "Identity carried by reference images in every prompt; log in to the Higgsfield CLI to train a Soul ID." },
  ] },
  { id: "director", label: "Creative director", implementations: [{ id: "claude.opus", lane: "claude", model: env.CLAUDE_DIRECTOR_MODEL, label: "Claude (director)" }] },
  { id: "qa.vision", label: "Vision QA", implementations: [{ id: "claude.haiku", lane: "claude", model: env.CLAUDE_QA_MODEL, label: "Claude (QA)" }] },
];

export interface LaneStatus {
  cloud: { available: boolean; reason?: string };
  cli: { available: boolean; state: CliAuthState; path?: string | null; reason?: string };
  claude: { available: boolean; reason?: string };
  local: { available: true };
  mock: boolean;
  checkedAt: number;
}

let _laneStatus: LaneStatus | null = null;
let _laneCheckedAt = 0;

export async function laneStatus(force = false): Promise<LaneStatus> {
  if (!force && _laneStatus && Date.now() - _laneCheckedAt < 60_000) return _laneStatus;
  if (env.MOCK_PROVIDERS) {
    _laneStatus = { cloud: { available: true }, cli: { available: true, state: "ok", path: "mock" }, claude: { available: true }, local: { available: true }, mock: true, checkedAt: Date.now() };
    _laneCheckedAt = Date.now();
    return _laneStatus;
  }
  const cloud = cloudClient().available ? { available: true } : { available: false, reason: "Add HIGGSFIELD_API_KEY and HIGGSFIELD_API_SECRET to .env.local" };
  const cliPath = findCli();
  let cliState: CliAuthState = "not_installed";
  if (cliPath) cliState = await authState();
  const cli = {
    available: cliState === "ok",
    state: cliState,
    path: cliPath,
    reason: cliState === "not_installed" ? "Install with `npm i -g @higgsfield/cli@1.1.26`" : cliState === "needs_login" ? "Run `higgsfield auth login` in a terminal" : cliState === "unknown" ? "CLI responded unexpectedly; check logs/cli" : undefined,
  };
  const claude = claudeAvailable() ? { available: true } : { available: false, reason: "Add ANTHROPIC_API_KEY to .env.local" };
  _laneStatus = { cloud, cli, claude, local: { available: true }, mock: false, checkedAt: Date.now() };
  _laneCheckedAt = Date.now();
  return _laneStatus;
}

export function markCliNeedsLogin(): void {
  if (_laneStatus) _laneStatus.cli = { available: false, state: "needs_login", path: _laneStatus.cli.path, reason: "Run `higgsfield auth login` in a terminal" };
}

export interface Resolved {
  capability: CapabilityId;
  impl: Implementation;
  alternates: Implementation[];
  unavailable: boolean;
  reason?: string;
}

export type Overrides = Partial<Record<CapabilityId, string>>; // capability → implementation id

function laneOk(lane: LaneId, s: LaneStatus): boolean {
  if (lane === "cloud") return s.cloud.available;
  if (lane === "cli") return s.cli.available;
  if (lane === "claude") return s.claude.available;
  return true;
}

export function resolveCapability(id: CapabilityId, status: LaneStatus, overrides: Overrides = {}, opts: { exclude?: string[] } = {}): Resolved {
  const def = CAPABILITIES.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown capability ${id}`);
  const available = def.implementations.filter((i) => laneOk(i.lane, status) && !opts.exclude?.includes(i.id));
  const preferredId = overrides[id];
  const preferred = preferredId ? available.find((i) => i.id === preferredId) : undefined;
  const impl = preferred ?? available[0];
  if (!impl) {
    const reason = def.implementations.map((i) => `${i.label}: ${i.lane === "cli" ? status.cli.reason : i.lane === "cloud" ? status.cloud.reason : status.claude.reason}`).join("; ");
    return { capability: id, impl: def.implementations[0], alternates: [], unavailable: true, reason };
  }
  return { capability: id, impl, alternates: available.filter((i) => i.id !== impl.id), unavailable: false };
}

export async function resolveAll(overrides: Overrides = {}): Promise<Record<CapabilityId, Resolved>> {
  const s = await laneStatus();
  const out = {} as Record<CapabilityId, Resolved>;
  for (const c of CAPABILITIES) out[c.id] = resolveCapability(c.id, s, overrides);
  return out;
}
