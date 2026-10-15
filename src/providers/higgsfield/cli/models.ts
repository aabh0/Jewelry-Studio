/** Consumer CLI job_set_types used by the app (docs/research/higgsfield-cli/MODELS.md). */
export interface CliModelDef {
  jst: string;
  name: string;
  output: "image" | "video" | "other";
  refFlag: "--image" | "--image-references" | null;
  maxRefs?: number;
  aspectRatios?: readonly string[];
  resolutions?: readonly string[];
  qualities?: readonly string[];
  notes?: string;
}

export const CLI_MODELS: Record<string, CliModelDef> = {
  gpt_image_2_5: { jst: "gpt_image_2_5", name: "GPT Image 2.5", output: "image", refFlag: "--image", maxRefs: 16, aspectRatios: ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9", "27:16", "16:27", "9:8", "8:9", "4:5", "5:4"], resolutions: ["1k", "2k", "4k"], qualities: ["low", "medium", "high", "xhigh", "max"] },
  gpt_image_2: { jst: "gpt_image_2", name: "GPT Image 2 (inpaint)", output: "image", refFlag: "--image", maxRefs: 16, aspectRatios: ["auto", "1:1", "4:3", "3:4", "16:9", "21:9", "9:16", "3:2", "2:3", "4:5", "5:4"], resolutions: ["1k", "2k", "4k"], qualities: ["low", "medium", "high"], notes: "--is_inpaint true --mask <path>" },
  nano_banana_2: { jst: "nano_banana_2", name: "Nano Banana Pro", output: "image", refFlag: "--image", maxRefs: 14, aspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "9:16", "16:9", "21:9"], resolutions: ["1k", "2k", "4k"] },
  seedream_v4_5: { jst: "seedream_v4_5", name: "Seedream 4.5", output: "image", refFlag: "--image", maxRefs: 14, aspectRatios: ["1:1", "4:3", "16:9", "3:2", "21:9", "3:4", "9:16", "2:3"], qualities: ["basic", "high"] },
  flux_kontext: { jst: "flux_kontext", name: "Flux Kontext", output: "image", refFlag: "--image", maxRefs: 4, aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"] },
  text2image_soul_v2: { jst: "text2image_soul_v2", name: "Soul V2 (+ Soul ID)", output: "image", refFlag: "--image", maxRefs: 1, aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], qualities: ["1.5k", "2k"], notes: "--soul-id <uuid>" },
  soul_cinematic: { jst: "soul_cinematic", name: "Soul Cinematic", output: "image", refFlag: "--image", maxRefs: 1, aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"], qualities: ["1.5k", "2k"] },
  image_background_remover: { jst: "image_background_remover", name: "Background remover", output: "image", refFlag: "--image", maxRefs: 1 },
  outpaint: { jst: "outpaint", name: "Outpaint", output: "image", refFlag: "--image", maxRefs: 1, aspectRatios: ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "9:16", "16:9", "21:9"] },
  topaz_image: { jst: "topaz_image", name: "Topaz upscale", output: "image", refFlag: "--image", maxRefs: 1, notes: "schema via `higgsfield model get topaz_image`" },
  bytedance_image_upscale: { jst: "bytedance_image_upscale", name: "ByteDance upscale", output: "image", refFlag: "--image", maxRefs: 1 },
  video_upscale: { jst: "video_upscale", name: "Video upscale", output: "video", refFlag: null },
  topaz_video: { jst: "topaz_video", name: "Topaz video upscale", output: "video", refFlag: null },
  video_background_remover: { jst: "video_background_remover", name: "Video background remover", output: "video", refFlag: null },
  kling3_0: { jst: "kling3_0", name: "Kling 3.0", output: "video", refFlag: null, aspectRatios: ["16:9", "9:16", "1:1"], notes: "--start-image --end-image --mode std|pro|4k --duration --sound off" },
  seedance_2_5: { jst: "seedance_2_5", name: "Seedance 2.5", output: "video", refFlag: "--image-references", maxRefs: 15, resolutions: ["480p", "720p", "1080p"], notes: "--mode omni_reference --start-image --end-image" },
  seedance_2_0: { jst: "seedance_2_0", name: "Seedance 2.0", output: "video", refFlag: "--image", maxRefs: 9, resolutions: ["480p", "720p", "1080p", "4k"] },
  text2speech_v2: { jst: "text2speech_v2", name: "Text to speech", output: "other", refFlag: null },
  sonilo_music: { jst: "sonilo_music", name: "Sonilo music", output: "other", refFlag: null },
};
