/** Size tables from docs/research/jewelry-craft.md §1. All mm. */

const ROUND_CARAT_MM: [number, number][] = [
  [0.05, 2.4], [0.1, 3.0], [0.25, 4.1], [0.5, 5.1], [0.75, 5.8], [1.0, 6.5], [1.5, 7.4], [2.0, 8.2], [3.0, 9.3], [4.0, 10.2], [5.0, 11.0],
];

export function roundCaratToMm(carat: number): number {
  if (carat <= ROUND_CARAT_MM[0][0]) return ROUND_CARAT_MM[0][1];
  for (let i = 1; i < ROUND_CARAT_MM.length; i++) {
    const [c1, m1] = ROUND_CARAT_MM[i];
    const [c0, m0] = ROUND_CARAT_MM[i - 1];
    if (carat <= c1) return +(m0 + ((carat - c0) / (c1 - c0)) * (m1 - m0)).toFixed(1);
  }
  const last = ROUND_CARAT_MM[ROUND_CARAT_MM.length - 1];
  return +(last[1] * Math.cbrt(carat / last[0])).toFixed(1);
}

/** Approximate [length, width] for a shape at a given carat. */
export function stoneMm(shape: string, carat: number): [number, number] {
  const d = roundCaratToMm(carat);
  switch (shape) {
    case "oval":
    case "cushion":
      return [+(d * 1.3).toFixed(1), +(d * 0.95).toFixed(1)];
    case "pear":
      return [+(d * 1.45).toFixed(1), +(d * 0.9).toFixed(1)];
    case "marquise":
      return [+(d * 1.9).toFixed(1), +(d * 0.8).toFixed(1)];
    case "emerald":
    case "radiant":
    case "baguette":
      return [+(d * 1.35).toFixed(1), +(d * 0.95).toFixed(1)];
    case "princess":
    case "asscher":
      return [+(d * 0.9).toFixed(1), +(d * 0.9).toFixed(1)];
    default:
      return [d, d];
  }
}

export const CHAIN_LENGTH_LANDMARK: { maxIn: number; landmark: string; label: string }[] = [
  { maxIn: 14, landmark: "base_of_neck", label: "tight at the base of the neck (collar/choker)" },
  { maxIn: 16, landmark: "base_of_throat", label: "at the base of the throat, just above the collarbone (choker)" },
  { maxIn: 18, landmark: "collarbone", label: "resting on the collarbone (princess length)" },
  { maxIn: 20, landmark: "below_collarbone", label: "just below the collarbone" },
  { maxIn: 24, landmark: "sternum", label: "at the top of the sternum (matinee)" },
  { maxIn: 30, landmark: "mid_chest", label: "mid-chest (opera)" },
  { maxIn: 999, landmark: "below_bust", label: "below the bust, often doubled (rope)" },
];

export function chainLandmark(lengthIn: number): { landmark: string; label: string } {
  for (const row of CHAIN_LENGTH_LANDMARK) if (lengthIn <= row.maxIn) return row;
  return CHAIN_LENGTH_LANDMARK[CHAIN_LENGTH_LANDMARK.length - 1];
}

export const US_RING_SIZE_MM: Record<number, number> = { 4: 14.9, 5: 15.7, 6: 16.5, 7: 17.3, 8: 18.1, 9: 19.0, 10: 19.8, 11: 20.6, 12: 21.4 };

export function bandWidthClass(mm: number): string {
  if (mm < 2.25) return "fine";
  if (mm < 3.5) return "classic";
  if (mm < 7) return "bold";
  return "statement";
}

export function hoopClass(diameterMm: number): string {
  if (diameterMm < 20) return "small";
  if (diameterMm < 40) return "medium";
  if (diameterMm < 60) return "large";
  return "statement";
}

export function studClass(mm: number): string {
  if (mm < 5) return "mini";
  if (mm < 9) return "standard";
  return "large";
}

export function dropClass(mm: number): string {
  if (mm < 40) return "short";
  if (mm < 65) return "mid";
  return "long (reaches the jawline)";
}

export const FINGER_BASE_WIDTH_MM = 17; // scale anchor for adult hands
export const TENNIS_WIDTH_BY_CTTW: [number, number][] = [[1, 2.1], [2, 2.8], [3, 3.2], [5, 4.0]];
