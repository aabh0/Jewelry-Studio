/**
 * Cloud API endpoint catalog used by this app. Schemas transcribed from
 * docs/research/higgsfield-api.md Appendix A (synced 2026-09-26). Keep in sync when probes find changes.
 */
export type OutputKind = "image" | "video";

export interface EndpointDef {
  id: string;
  name: string;
  output: OutputKind;
  aspectRatios?: readonly string[];
  resolutions?: readonly string[];
  durations?: { min: number; max: number } | readonly number[];
  maxRefs?: number;
  refField?: "image_urls" | "image_url";
  startField?: "image_url" | "first_frame_url";
  endField?: "end_image_url" | "last_image_url" | "last_frame_url";
  notes?: string;
  /** rough list price per call or per second, used only when /estimate returns a formula */
  priceHint?: { perImageUsd?: number; perSecondUsd?: number; tokenRateUsdPer1k?: number };
}

export const CLOUD_ENDPOINTS: Record<string, EndpointDef> = {
  "marketing-studio/image/flare": {
    id: "marketing-studio/image/flare", name: "GPT Image 2.5 Flare (Marketing Studio)", output: "image",
    aspectRatios: ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], resolutions: ["1k", "2k", "4k"], maxRefs: 16, refField: "image_urls",
    priceHint: { perImageUsd: 0.2 },
  },
  "marketing-studio/image/sunburst": {
    id: "marketing-studio/image/sunburst", name: "GPT Image 2.5 Sunburst (Marketing Studio)", output: "image",
    aspectRatios: ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], resolutions: ["1k", "2k", "4k"], maxRefs: 16, refField: "image_urls",
    priceHint: { perImageUsd: 0.2 },
  },
  "marketing-studio/image": {
    id: "marketing-studio/image", name: "Marketing Studio Image", output: "image",
    aspectRatios: ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"], resolutions: ["1k", "2k", "4k"], maxRefs: 16, refField: "image_urls",
    priceHint: { perImageUsd: 0.44 },
  },
  "higgsfield-ai/soul/v2/standard": {
    id: "higgsfield-ai/soul/v2/standard", name: "Soul 2", output: "image",
    aspectRatios: ["9:16", "16:9", "4:3", "3:4", "1:1", "2:3", "3:2"], resolutions: ["720p", "1080p"], maxRefs: 0, notes: "No reference inputs.",
    priceHint: { perImageUsd: 0.004 },
  },
  "alibaba/qwen-image-3/edit": {
    id: "alibaba/qwen-image-3/edit", name: "Qwen Image 3 Edit", output: "image",
    aspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"], resolutions: ["1k", "2k"], maxRefs: 3, refField: "image_urls",
    priceHint: { perImageUsd: 0.04 },
  },
  "xai/grok-imagine-image-2.0": {
    id: "xai/grok-imagine-image-2.0", name: "Grok Imagine 2.0", output: "image",
    aspectRatios: ["auto", "1:1", "1:2", "2:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"], resolutions: ["1k", "2k"], maxRefs: 10, refField: "image_urls",
    priceHint: { perImageUsd: 0.06 },
  },
  "kling-video/v3.0/pro/image-to-video": {
    id: "kling-video/v3.0/pro/image-to-video", name: "Kling 3.0 Pro (image to video)", output: "video",
    durations: { min: 3, max: 15 }, refField: "image_url", startField: "image_url", endField: "last_image_url",
    priceHint: { perSecondUsd: 0.0924 },
  },
  "kling-video/v3.0/std/image-to-video": {
    id: "kling-video/v3.0/std/image-to-video", name: "Kling 3.0 Standard (image to video)", output: "video",
    durations: { min: 3, max: 15 }, startField: "image_url", endField: "last_image_url", priceHint: { perSecondUsd: 0.0694 },
  },
  "kling-video/v3.0/4k/image-to-video": {
    id: "kling-video/v3.0/4k/image-to-video", name: "Kling 3.0 4K (image to video)", output: "video",
    durations: { min: 3, max: 15 }, startField: "image_url", endField: "last_image_url", priceHint: { perSecondUsd: 0.231 },
  },
  "kling-video/v3.0-turbo/image-to-video": {
    id: "kling-video/v3.0-turbo/image-to-video", name: "Kling 3.0 Turbo (image to video)", output: "video",
    durations: { min: 3, max: 15 }, resolutions: ["720p", "1080p"], startField: "image_url", priceHint: { perSecondUsd: 0.0616 },
  },
  "kling-video/o3/image-reference": {
    id: "kling-video/o3/image-reference", name: "Kling O3 (image reference)", output: "video",
    aspectRatios: ["16:9", "9:16", "1:1"], durations: { min: 3, max: 15 }, maxRefs: 4, refField: "image_urls", startField: "first_frame_url", endField: "last_frame_url",
    priceHint: { perSecondUsd: 0.0924 },
  },
  "kling-video/o3/first-last-frame": {
    id: "kling-video/o3/first-last-frame", name: "Kling O3 (first/last frame)", output: "video",
    durations: { min: 3, max: 15 }, startField: "first_frame_url", endField: "last_frame_url", priceHint: { perSecondUsd: 0.0924 },
  },
  "kling-video/o3/video-edit": {
    id: "kling-video/o3/video-edit", name: "Kling O3 (video edit)", output: "video", maxRefs: 4, refField: "image_urls", priceHint: { perSecondUsd: 0.0924 },
  },
  "bytedance/seedance-2.5/image-to-video": {
    id: "bytedance/seedance-2.5/image-to-video", name: "Seedance 2.5 (image to video)", output: "video",
    durations: { min: 4, max: 30 }, resolutions: ["480p", "720p"], startField: "image_url", endField: "end_image_url", priceHint: { tokenRateUsdPer1k: 0.0214 },
  },
  "bytedance/seedance-2.5/reference-to-video": {
    id: "bytedance/seedance-2.5/reference-to-video", name: "Seedance 2.5 (reference to video)", output: "video",
    aspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"], durations: { min: 4, max: 30 }, resolutions: ["480p", "720p"], maxRefs: 30, refField: "image_urls", priceHint: { tokenRateUsdPer1k: 0.0214 },
  },
  "bytedance/seedance-2.5/video-extend": {
    id: "bytedance/seedance-2.5/video-extend", name: "Seedance 2.5 (video extend)", output: "video",
    durations: { min: 4, max: 30 }, resolutions: ["480p", "720p"], maxRefs: 30, refField: "image_urls", priceHint: { tokenRateUsdPer1k: 0.01284 },
  },
  "bytedance/seedance-2.0/image-to-video": {
    id: "bytedance/seedance-2.0/image-to-video", name: "Seedance 2.0 (image to video)", output: "video",
    durations: { min: 4, max: 15 }, resolutions: ["480p", "720p", "1080p", "4k"], startField: "image_url", endField: "end_image_url", priceHint: { tokenRateUsdPer1k: 0.014 },
  },
  "bytedance/seedance-2.0/reference-to-video": {
    id: "bytedance/seedance-2.0/reference-to-video", name: "Seedance 2.0 (reference to video)", output: "video",
    durations: { min: 4, max: 15 }, resolutions: ["480p", "720p", "1080p", "4k"], maxRefs: 9, refField: "image_urls", priceHint: { tokenRateUsdPer1k: 0.014 },
  },
  "minimax/h3/reference-to-video": {
    id: "minimax/h3/reference-to-video", name: "MiniMax H3 (reference to video)", output: "video", durations: { min: 5, max: 15 }, maxRefs: 9, refField: "image_urls", priceHint: { perSecondUsd: 0.08 },
  },
  "minimax/h3/image-to-video": {
    id: "minimax/h3/image-to-video", name: "MiniMax H3 (image to video)", output: "video", durations: { min: 5, max: 15 }, startField: "image_url", endField: "end_image_url", priceHint: { perSecondUsd: 0.08 },
  },
  "higgsfield/genjutsu/object-swap/v1.0": {
    id: "higgsfield/genjutsu/object-swap/v1.0", name: "Genjutsu Object Swap", output: "video", maxRefs: 8, refField: "image_urls", resolutions: ["720p", "480p"], priceHint: { perSecondUsd: 0.681 },
  },
  "higgsfield/cinema-studio/4.0": {
    id: "higgsfield/cinema-studio/4.0", name: "Cinema Studio 4.0", output: "video", durations: { min: 4, max: 30 }, resolutions: ["480p", "720p"], maxRefs: 30, refField: "image_urls", priceHint: { tokenRateUsdPer1k: 0.02 },
  },
};

/** Legacy ids to probe once; never used unless the probe confirms them. */
export const LEGACY_PROBE_IDS = ["nano-banana-pro", "bytedance/seedream/v4/text-to-image", "flux-pro/kontext/max/text-to-image"];

export function endpoint(id: string): EndpointDef {
  const e = CLOUD_ENDPOINTS[id];
  if (!e) throw new Error(`Unknown cloud endpoint ${id}`);
  return e;
}

/** Local fallback estimate when /estimate returns a formula. */
export function formulaEstimateUsd(id: string, params: Record<string, unknown>): number | null {
  const e = CLOUD_ENDPOINTS[id];
  if (!e?.priceHint) return null;
  const ph = e.priceHint;
  if (e.output === "image") return ph.perImageUsd ?? null;
  const duration = Number(params.duration ?? 5);
  if (ph.perSecondUsd) return +(ph.perSecondUsd * duration).toFixed(3);
  if (ph.tokenRateUsdPer1k) {
    const res = String(params.resolution ?? "720p");
    const dims: Record<string, [number, number]> = { "480p": [854, 480], "720p": [1280, 720], "1080p": [1920, 1080], "4k": [3840, 2160] };
    const [w, h] = dims[res] ?? dims["720p"];
    const tokens = Math.ceil((duration * w * h * 24) / 1024);
    const rate = res === "4k" && id.includes("seedance-2.0") ? 0.008 : ph.tokenRateUsdPer1k;
    return +((tokens / 1000) * rate).toFixed(3);
  }
  return null;
}
