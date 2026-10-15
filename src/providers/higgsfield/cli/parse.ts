export interface CliJobResult {
  urls: string[];
  raw: unknown;
  jobId?: string;
}

const MEDIA_EXT = /\.(png|jpe?g|webp|gif|mp4|mov|webm|mp3|wav|m4a|glb)(\?|$)/i;

/** The CLI prints JSON, sometimes preceded by progress lines. Find the last JSON value in stdout. */
export function parseCliJson(stdout: string): unknown {
  const s = stdout.trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    /* fall through */
  }
  // Scan for the first line that starts a JSON value and try progressively.
  const lines = s.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith("{") || l.startsWith("[")) {
      const chunk = lines.slice(i).join("\n");
      try {
        return JSON.parse(chunk);
      } catch {
        /* keep scanning */
      }
    }
  }
  // Last resort: largest balanced {...} or [...] block
  const start = Math.max(s.lastIndexOf("\n{"), s.lastIndexOf("\n["));
  if (start >= 0) {
    try {
      return JSON.parse(s.slice(start + 1));
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Collect any https URL that looks like media, preferring well-known result fields. */
export function extractResultUrls(json: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: unknown) => {
    if (typeof u === "string" && /^https?:\/\//.test(u) && MEDIA_EXT.test(u) && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  };
  const preferred = ["result_url", "results", "outputs", "output", "media", "result", "url", "video_url", "image_url", "files"];
  const walk = (v: unknown, depth: number) => {
    if (depth > 8 || v === null || v === undefined) return;
    if (typeof v === "string") return push(v);
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const k of preferred) if (k in o) walk(o[k], depth + 1);
      for (const [k, val] of Object.entries(o)) if (!preferred.includes(k)) walk(val, depth + 1);
    }
  };
  walk(json, 0);
  return out;
}
