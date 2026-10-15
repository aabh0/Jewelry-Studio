export const NEG_UNIVERSAL = "no AI artifacts, no warped or smeared text, no fake words baked into the image, no plastic look, no waxy surface, no cartoonish rendering, no extra fingers, no extra limbs, no melted geometry, no doubled subjects, no oversaturated HDR, no HDR halos, no oversharpened look, no flat fluorescent lighting, no harsh on-camera flash, no generic stock photography poses, no random unrelated brand logos, no watermarks, no signatures, no AI sheen on hair or skin, no doll-like rendering, no airbrush look, no flat solid color bands, no empty rectangular areas";
export const NEG_UNCANNY = "no AI uncanny faces, no warped facial geometry, no asymmetric eyes, no extra teeth, no melted facial features, no warped fingers or hands, no plastic skin, no orange-tan skin, no over-smoothed retouching, no doll eyes, no misaligned facial features, no rubber-like skin texture, no warped jewelry or glasses, no stiff unnatural posture";
export const NEG_TEXT = "no warped product label text, no garbled letters, no fake brand names, no melted typography, no doubled labels, no fictional logos";
export const NEG_STOCK = "no stale stock photography aesthetic, no synthetic stock-photo look, no over-staged feeling, no unrealistically clean environments, no clipart elements, no obviously composited backgrounds";
export const NEG_JEWELRY = "no extra stones, no extra or missing prongs, no duplicated or merged chain links, no floating jewelry, no plastic sheen on metal, no blurry facets, no invented hallmarks or engraving, no extra or fused fingers, no warped jewelry geometry, no redesigned setting";
export const NEG_VIDEO = "no morphing, no melting, no duplicated product, no objects passing through each other, no sparkle strobing, no flicker, no new objects appearing, no camera shake";

export function buildNegative(opts: { people?: boolean; text?: boolean; stock?: boolean; video?: boolean; learnedAvoids?: string[] }): string {
  const parts = [NEG_UNIVERSAL, NEG_JEWELRY];
  if (opts.people) parts.push(NEG_UNCANNY);
  if (opts.text) parts.push(NEG_TEXT);
  if (opts.stock) parts.push(NEG_STOCK);
  if (opts.video) parts.push(NEG_VIDEO);
  if (opts.learnedAvoids?.length) parts.push(opts.learnedAvoids.map((a) => (a.startsWith("no ") ? a : `no ${a}`)).join(", "));
  return parts.join(", ");
}
