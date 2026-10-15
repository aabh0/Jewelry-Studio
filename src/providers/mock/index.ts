/**
 * Deterministic fixture providers used when MOCK_PROVIDERS=1 (tests, e2e, demos without keys).
 * They produce real image/video files with sharp/ffmpeg so the rest of the pipeline is exercised for real.
 */
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { runFfmpeg, ENCODE_H264_FAST } from "@/providers/local/ffmpeg";

const PALETTE = ["#2B2A33", "#3D3A44", "#4A4756", "#5A5668", "#2F3B46", "#3E4A55"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export async function mockImage(dest: string, opts: { width: number; height: number; label: string; seed: string; refImage?: string }): Promise<void> {
  const h = hash(opts.seed);
  const bg = PALETTE[h % PALETTE.length];
  const gold = "#D4B27A";
  const cx = opts.width / 2, cy = opts.height / 2;
  const r = Math.min(opts.width, opts.height) * (0.18 + ((h >> 8) % 10) / 100);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}">
  <defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0%" stop-color="${bg}" stop-opacity="1"/><stop offset="100%" stop-color="#0C0C0D"/></radialGradient>
  <linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F3E3BE"/><stop offset="50%" stop-color="${gold}"/><stop offset="100%" stop-color="#7A6238"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#m)" stroke-width="${Math.max(6, r * 0.18)}"/>
  <circle cx="${cx}" cy="${cy - r}" r="${r * 0.22}" fill="#FFFFFF" opacity="0.92"/>
  <circle cx="${cx - r * 0.08}" cy="${cy - r * 1.08}" r="${r * 0.06}" fill="#FFFFFF"/>
  <text x="${opts.width / 2}" y="${opts.height - 28}" font-family="sans-serif" font-size="${Math.max(14, opts.width / 60)}" fill="#B8B5AD" text-anchor="middle">${escapeXml(opts.label.slice(0, 80))} · mock ${h.toString(16).slice(0, 6)}</text>
</svg>`;
  await fs.mkdir(path.dirname(dest), { recursive: true });
  let img = sharp(Buffer.from(svg));
  if (opts.refImage) {
    try {
      const thumb = await sharp(opts.refImage).resize(Math.round(opts.width * 0.18), Math.round(opts.width * 0.18), { fit: "inside" }).png().toBuffer();
      img = sharp(await img.png().toBuffer()).composite([{ input: thumb, left: 24, top: 24 }]);
    } catch {
      /* ignore bad refs in mock */
    }
  }
  await img.png().toFile(dest);
}

export async function mockVideo(dest: string, opts: { width: number; height: number; durationS: number; seed: string; startImage?: string }): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const w = opts.width + (opts.width % 2), h = opts.height + (opts.height % 2);
  if (opts.startImage) {
    const d = opts.durationS;
    await runFfmpeg(["-loop", "1", "-i", opts.startImage, "-t", String(d), "-vf", `scale=${w * 2}:-2,zoompan=z='min(zoom+0.0012,1.15)':d=${Math.round(d * 30)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=30,format=yuv420p`, "-r", "30", ...ENCODE_H264_FAST, "-an", dest], { logName: "mock-video" });
  } else {
    const hue = hash(opts.seed) % 360;
    await runFfmpeg(["-f", "lavfi", "-i", `testsrc2=size=${w}x${h}:rate=30`, "-t", String(opts.durationS), "-vf", `hue=h=${hue},format=yuv420p`, ...ENCODE_H264_FAST, "-an", dest], { logName: "mock-video" });
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function mockShotList(input: { products: { id: string; name: string }[]; talent: { id: string }[]; stills: number }) {
  const n = Math.max(3, Math.min(input.stills || 6, 12));
  const formats = ["hero_still_life", "macro_detail", "on_model_beauty_crop", "packshot_white", "lifestyle_editorial", "flat_lay", "hand_model", "hero_still_life", "macro_detail", "on_model_beauty_crop", "couples_gifting", "unboxing"] as const;
  const crops = { on_model_beauty_crop: "hand", hand_model: "hand" } as Record<string, string>;
  const shots = Array.from({ length: n }, (_, i) => {
    const format = formats[i % formats.length];
    const product = input.products[i % input.products.length];
    const needsTalent = ["on_model_beauty_crop", "hand_model", "couples_gifting", "lifestyle_editorial"].includes(format);
    return {
      title: `${format.replace(/_/g, " ")} — ${product.name}`,
      format,
      crop: crops[format],
      purpose: `Mock shot ${i + 1}: showcase ${product.name} as a ${format.replace(/_/g, " ")}.`,
      product_ids: [product.id],
      talent_id: needsTalent && input.talent[0] ? input.talent[0].id : undefined,
      lighting: {},
      scene: { environment: format === "lifestyle_editorial" ? "sunlit stone terrace" : "", props: [] },
      camera: { lens_mm: format === "macro_detail" ? 100 : 85, aperture: format === "macro_detail" ? "f11" : "f4", angle: "three_quarter_45", shot_size: format === "macro_detail" ? "ECU" : "CU", focus: "product" },
      aspect: "4:5",
      variants: 2,
      channels: ["ig_feed_45"],
      priority: 2,
      qa_focus: ["prong_count", "metal_color"],
    };
  });
  return { rationale: "Mock shot list for local testing.", shots, open_questions: [] };
}
