import type { z } from "zod";

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = sortKeys(v);
    }
    return out;
  }
  return value;
}

export function parseJson<T>(schema: z.ZodType<T>, raw: string | null | undefined, fallback?: T): T {
  if (raw === null || raw === undefined || raw === "") {
    if (fallback !== undefined) return fallback;
    throw new Error("Missing JSON value");
  }
  const parsed = schema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Invalid stored JSON: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function tryParseJson(raw: string | null | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
