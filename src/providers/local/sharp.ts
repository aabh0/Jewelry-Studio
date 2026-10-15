import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";

export interface ImageMeta {
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
}

export async function imageMeta(file: string): Promise<ImageMeta> {
  const m = await sharp(file).metadata();
  return { width: m.width ?? 0, height: m.height ?? 0, format: m.format ?? "unknown", hasAlpha: !!m.hasAlpha };
}

/** Copy an uploaded image into place as a clean file: auto-orient, strip EXIF, convert HEIC/others to PNG/JPEG. */
export async function normalizeUpload(src: string, destBase: string): Promise<{ file: string; mime: string; width: number; height: number }> {
  const img = sharp(src, { failOn: "none" }).rotate();
  const m = await img.metadata();
  const keepPng = m.hasAlpha || m.format === "png";
  const ext = keepPng ? ".png" : ".jpg";
  const file = destBase + ext;
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (keepPng) await img.png({ compressionLevel: 6 }).toFile(file);
  else await img.jpeg({ quality: 95, mozjpeg: true }).toFile(file);
  const out = await sharp(file).metadata();
  return { file, mime: keepPng ? "image/png" : "image/jpeg", width: out.width ?? 0, height: out.height ?? 0 };
}

export async function thumbnail(src: string, dest: string, width = 512): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await sharp(src, { failOn: "none" }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest);
}

/** Downscale for Claude vision: long edge <= maxEdge, JPEG q85, metadata stripped. Returns base64 + media type. */
export async function forVision(src: string, maxEdge = 1092): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const buf = await sharp(src, { failOn: "none" }).rotate().resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return { base64: buf.toString("base64"), mediaType: "image/jpeg" };
}

/** Pad an image to a target aspect with a mirrored, blurred fill (for API-only outpaint). Returns new dims and the inner rect. */
export async function padToAspect(src: string, dest: string, aspectW: number, aspectH: number): Promise<{ width: number; height: number; inner: { left: number; top: number; width: number; height: number } }> {
  const m = await sharp(src).metadata();
  const w = m.width ?? 0;
  const h = m.height ?? 0;
  const target = aspectW / aspectH;
  let W = w;
  let H = h;
  if (w / h < target) W = Math.round(h * target);
  else H = Math.round(w / target);
  W += W % 2;
  H += H % 2;
  const left = Math.round((W - w) / 2);
  const top = Math.round((H - h) / 2);
  const blurred = await sharp(src).resize(W, H, { fit: "fill" }).blur(40).modulate({ brightness: 0.9 }).toBuffer();
  await sharp(blurred).composite([{ input: await sharp(src).toBuffer(), left, top }]).png().toFile(dest);
  return { width: W, height: H, inner: { left, top, width: w, height: h } };
}

/** Composite `edited` over `original` only inside `mask` (white = edited), with feathering. */
export async function compositeWithMask(original: string, edited: string, mask: string, dest: string, featherPx = 12): Promise<void> {
  const m = await sharp(original).metadata();
  const w = m.width ?? 0;
  const h = m.height ?? 0;
  const editedResized = await sharp(edited).resize(w, h, { fit: "fill" }).removeAlpha().toBuffer();
  const maskBuf = await sharp(mask).resize(w, h, { fit: "fill" }).grayscale().blur(featherPx / 2).toColourspace("b-w").raw().toBuffer();
  const editedWithAlpha = await sharp(editedResized).joinChannel(maskBuf, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  await sharp(original).composite([{ input: editedWithAlpha, blend: "over" }]).png().toFile(dest);
}

/** Composite `source` (original pixels) back over `edited` inside rect (for outpaint center protection). */
export async function compositeRect(edited: string, source: string, rect: { left: number; top: number; width: number; height: number }, dest: string): Promise<void> {
  const src = await sharp(source).resize(rect.width, rect.height, { fit: "fill" }).toBuffer();
  await sharp(edited).composite([{ input: src, left: rect.left, top: rect.top }]).png().toFile(dest);
}

/** Crude structural similarity on 256px grayscale: 1 = identical. Used as a gate, not a metric. */
export async function similarity(a: string, b: string): Promise<number> {
  const size = 256;
  const [ra, rb] = await Promise.all([a, b].map((f) => sharp(f).resize(size, size, { fit: "fill" }).grayscale().raw().toBuffer()));
  let sumA = 0, sumB = 0;
  for (let i = 0; i < ra.length; i++) { sumA += ra[i]; sumB += rb[i]; }
  const mA = sumA / ra.length, mB = sumB / rb.length;
  let vA = 0, vB = 0, cov = 0, mad = 0;
  for (let i = 0; i < ra.length; i++) {
    const da = ra[i] - mA, db = rb[i] - mB;
    vA += da * da; vB += db * db; cov += da * db; mad += Math.abs(ra[i] - rb[i]);
  }
  vA /= ra.length; vB /= rb.length; cov /= ra.length; mad /= ra.length;
  const c1 = 6.5, c2 = 58.5;
  const ssim = ((2 * mA * mB + c1) * (2 * cov + c2)) / ((mA * mA + mB * mB + c1) * (vA + vB + c2));
  const madScore = 1 - mad / 255;
  return +(0.5 * ssim + 0.5 * madScore).toFixed(3);
}

/** Mean hue/saturation of the center region (rough product-area proxy for packshots). */
export async function centerHueSat(file: string): Promise<{ hue: number; sat: number }> {
  const m = await sharp(file).metadata();
  const w = m.width ?? 0, h = m.height ?? 0;
  const cw = Math.max(8, Math.round(w * 0.5)), ch = Math.max(8, Math.round(h * 0.5));
  const buf = await sharp(file).extract({ left: Math.round((w - cw) / 2), top: Math.round((h - ch) / 2), width: cw, height: ch }).resize(64, 64, { fit: "fill" }).removeAlpha().raw().toBuffer();
  let sx = 0, sy = 0, ssat = 0, n = 0;
  for (let i = 0; i < buf.length; i += 3) {
    const r = buf[i] / 255, g = buf[i + 1] / 255, b = buf[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    const sat = max === 0 ? 0 : d / max;
    if (sat < 0.05 || max < 0.15) continue; // ignore neutral background/shadow pixels
    let hue = 0;
    if (d !== 0) {
      if (max === r) hue = ((g - b) / d) % 6;
      else if (max === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    sx += Math.cos((hue * Math.PI) / 180); sy += Math.sin((hue * Math.PI) / 180); ssat += sat; n++;
  }
  if (n === 0) return { hue: 0, sat: 0 };
  let hue = (Math.atan2(sy / n, sx / n) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  return { hue: +hue.toFixed(1), sat: +(ssat / n).toFixed(3) };
}

export async function upscaleLocal(src: string, dest: string, factor = 2): Promise<void> {
  const m = await sharp(src).metadata();
  await sharp(src).resize({ width: Math.round((m.width ?? 0) * factor), kernel: sharp.kernel.lanczos3 }).sharpen({ sigma: 0.8, m1: 0.5, m2: 0.4 }).png().toFile(dest);
}

export async function resizeCover(src: string, dest: string, w: number, h: number, focal = { x: 0.5, y: 0.5 }, format: "jpg" | "png" = "jpg", quality = 90): Promise<void> {
  const m = await sharp(src).metadata();
  const sw = m.width ?? 0, sh = m.height ?? 0;
  const scale = Math.max(w / sw, h / sh);
  const rw = Math.ceil(sw * scale), rh = Math.ceil(sh * scale);
  const left = Math.min(Math.max(Math.round((rw - w) * focal.x), 0), rw - w);
  const top = Math.min(Math.max(Math.round((rh - h) * focal.y), 0), rh - h);
  let p = sharp(src).resize(rw, rh).extract({ left, top, width: w, height: h });
  p = format === "png" ? p.png() : p.jpeg({ quality, mozjpeg: true });
  await p.toFile(dest);
}

export async function contactSheetStills(files: string[], dest: string, cols = 3, cell = 400): Promise<void> {
  const rows = Math.ceil(files.length / cols);
  const tiles = await Promise.all(files.map((f) => sharp(f).resize(cell, cell, { fit: "contain", background: "#111" }).toBuffer()));
  await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: "#111" } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * cell, top: Math.floor(i / cols) * cell })))
    .jpeg({ quality: 85 })
    .toFile(dest);
}

/** Render an SVG to PNG (used for text overlays and end cards). */
export async function svgToPng(svg: string, dest: string): Promise<void> {
  await sharp(Buffer.from(svg)).png().toFile(dest);
}

export async function solidPng(w: number, h: number, color: string, dest: string): Promise<void> {
  await sharp({ create: { width: w, height: h, channels: 4, background: color } }).png().toFile(dest);
}

export async function cropToRect(src: string, dest: string, rect: { left: number; top: number; width: number; height: number }): Promise<void> {
  await sharp(src).extract(rect).png().toFile(dest);
}

export async function adjust(src: string, dest: string, p: { brightness?: number; saturation?: number; contrast?: number; warmth?: number }): Promise<void> {
  let img = sharp(src);
  if (p.brightness !== undefined || p.saturation !== undefined) img = img.modulate({ brightness: p.brightness ?? 1, saturation: p.saturation ?? 1 });
  if (p.contrast !== undefined && p.contrast !== 1) img = img.linear(p.contrast, 128 * (1 - p.contrast));
  if (p.warmth !== undefined && p.warmth !== 0) {
    const k = Math.max(-1, Math.min(1, p.warmth));
    img = img.tint({ r: 255, g: Math.round(255 - 20 * Math.max(k, 0)), b: Math.round(255 - 60 * Math.max(k, 0) + 40 * Math.max(-k, 0)) });
  }
  await img.png().toFile(dest);
}
