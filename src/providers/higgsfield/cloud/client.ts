import fs from "node:fs/promises";
import { env } from "@/env";
import { log } from "@/lib/log";
import { mimeFor } from "@/lib/files";
import { CloudApiError, type SubmitResponse, type StatusResponse, type UploadUrlResponse, type EstimateResponse, type CloudStatus } from "./types";

export interface CloudClientOptions {
  baseUrl?: string;
  key?: string;
  secret?: string;
  fetchImpl?: typeof fetch;
}

const TERMINAL: CloudStatus[] = ["completed", "failed", "nsfw", "canceled", "cancelled"];

export class HiggsfieldCloudClient {
  private baseUrl: string;
  private auth: string | null;
  private f: typeof fetch;

  constructor(opts: CloudClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? env.HIGGSFIELD_BASE_URL).replace(/\/$/, "");
    const key = opts.key ?? env.HIGGSFIELD_API_KEY;
    const secret = opts.secret ?? env.HIGGSFIELD_API_SECRET;
    this.auth = key && secret ? `Key ${key}:${secret}` : null;
    this.f = opts.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  }

  get available(): boolean {
    return this.auth !== null;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    if (!this.auth) throw new CloudApiError("Higgsfield Cloud API credentials are missing (HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET).", 0, null, false, "missing_credentials");
    return { Authorization: this.auth, "Content-Type": "application/json", "User-Agent": "jewelry-studio/0.1", ...extra };
  }

  private async request<T>(method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}, retries = 3): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : "/" + path}`;
    let attempt = 0;
    for (;;) {
      attempt++;
      let res: Response;
      try {
        res = await this.f(url, { method, headers: this.headers(extraHeaders), body: body === undefined ? undefined : JSON.stringify(body) });
      } catch (err) {
        if (attempt <= retries) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new CloudApiError(`Network error calling ${path}: ${(err as Error).message}`, 0, null, true, "network");
      }
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      if (res.ok) return json as T;
      const detail = extractDetail(json);
      const code = classify(res.status, detail);
      const retryable = code === "rate_limited" || code === "server_error" || code === "concurrency";
      if (retryable && attempt <= retries && method === "GET") {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new CloudApiError(`${res.status} ${detail}`, res.status, json, retryable, code);
    }
  }

  async submit(endpointId: string, params: Record<string, unknown>, opts: { idempotencyKey?: string; webhook?: string } = {}): Promise<SubmitResponse> {
    const qs = opts.webhook ? `?hf_webhook=${encodeURIComponent(opts.webhook)}` : "";
    const headers: Record<string, string> = {};
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    // Never retry a generation POST blindly: retries=0, caller re-sends with the same Idempotency-Key.
    return this.request<SubmitResponse>("POST", `/${endpointId}${qs}`, params, headers, 0);
  }

  async status(requestId: string): Promise<StatusResponse> {
    return this.request<StatusResponse>("GET", `/requests/${requestId}/status`);
  }

  async cancel(requestId: string): Promise<boolean> {
    try {
      await this.request("POST", `/requests/${requestId}/cancel`, undefined, {}, 0);
      return true;
    } catch (err) {
      if (err instanceof CloudApiError && err.status === 400) return false;
      throw err;
    }
  }

  async estimate(endpointId: string, params: Record<string, unknown>): Promise<{ usd: number | null; description?: string; raw: EstimateResponse }> {
    const raw = await this.request<EstimateResponse>("POST", `/estimate/${endpointId}`, params, {}, 1);
    const usd = raw?.usd !== undefined && raw.usd !== null ? Number(raw.usd) : null;
    return { usd: Number.isFinite(usd as number) ? usd : null, description: raw?.pricing_description, raw };
  }

  async generateUploadUrl(contentType: string): Promise<UploadUrlResponse> {
    return this.request<UploadUrlResponse>("POST", "/files/generate-upload-url", { content_type: contentType }, {}, 2);
  }

  /** Upload a local file via the presigned URL flow. Returns the public URL to use in generation params. */
  async uploadFile(absPath: string, contentType?: string): Promise<string> {
    const mime = contentType ?? mimeFor(absPath);
    const { upload_url, public_url, upload_headers } = await this.generateUploadUrl(mime);
    const bytes = await fs.readFile(absPath);
    const headers: Record<string, string> = upload_headers && Object.keys(upload_headers).length ? { ...upload_headers } : { "Content-Type": mime };
    const res = await this.f(upload_url, { method: "PUT", headers, body: new Uint8Array(bytes) });
    if (!res.ok) throw new CloudApiError(`Upload PUT failed: ${res.status} ${await res.text()}`, res.status, null, res.status >= 500, "upload_failed");
    return public_url;
  }

  /** Poll until terminal. Backoff 2s → ×1.5 → 10s cap with jitter. */
  async waitFor(requestId: string, opts: { timeoutMs: number; onPoll?: (s: StatusResponse) => void; isCancelled?: () => boolean; onCancel?: () => Promise<void> }): Promise<StatusResponse> {
    const start = Date.now();
    let delay = 2000;
    for (;;) {
      if (opts.isCancelled?.()) {
        await opts.onCancel?.();
        throw new CloudApiError("cancelled", 0, null, false, "cancelled");
      }
      const s = await this.status(requestId);
      opts.onPoll?.(s);
      if (TERMINAL.includes(s.status)) return s;
      if (Date.now() - start > opts.timeoutMs) throw new CloudApiError(`Timed out waiting for request ${requestId}`, 0, null, false, "timeout");
      await sleep(delay * (0.8 + Math.random() * 0.4));
      delay = Math.min(delay * 1.5, 10_000);
    }
  }

  async download(url: string, dest: string): Promise<void> {
    const res = await this.f(url);
    if (!res.ok) throw new CloudApiError(`Download failed ${res.status} for ${url}`, res.status, null, res.status >= 500, "download_failed");
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(dest, buf);
  }
}

export function outputUrls(s: StatusResponse): string[] {
  const urls: string[] = [];
  if (Array.isArray(s.images)) for (const i of s.images) if (i?.url) urls.push(i.url);
  if (s.video?.url) urls.push(s.video.url);
  if (s.audio?.url) urls.push(s.audio.url);
  if (Array.isArray(s.audios)) for (const a of s.audios) if (a?.url) urls.push(a.url);
  if (urls.length === 0) {
    // defensive: scan other keys for {url}
    for (const [k, v] of Object.entries(s)) {
      if (["status", "request_id", "status_url", "cancel_url", "error"].includes(k)) continue;
      if (v && typeof v === "object" && "url" in (v as object) && typeof (v as { url: unknown }).url === "string") urls.push((v as { url: string }).url);
      if (Array.isArray(v)) for (const it of v) if (it && typeof it === "object" && typeof (it as { url?: unknown }).url === "string") urls.push((it as { url: string }).url);
    }
  }
  return urls;
}

export function errorMessage(s: StatusResponse): string {
  if (!s.error) return s.status === "nsfw" ? "Rejected by content moderation (refunded)." : "Generation failed (refunded).";
  if (typeof s.error === "string") return s.error;
  return s.error.message ?? JSON.stringify(s.error);
}

function extractDetail(json: unknown): string {
  if (!json) return "";
  if (typeof json === "string") return json.slice(0, 300);
  const j = json as { detail?: unknown; message?: unknown; error?: unknown };
  const d = j.detail ?? j.message ?? j.error;
  if (!d) return JSON.stringify(json).slice(0, 300);
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => (typeof x === "string" ? x : `${(x as { loc?: unknown[] }).loc?.join(".") ?? ""}: ${(x as { msg?: string }).msg ?? JSON.stringify(x)}`)).join("; ");
  return JSON.stringify(d).slice(0, 300);
}

function classify(status: number, detail: string): string {
  if (status === 401) return "auth";
  if (status === 402 || status === 403) return "insufficient_credits";
  if (status === 404) return "not_found";
  if (status === 422) return "validation";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  if (status === 400 && /concurren/i.test(detail)) return "concurrency";
  if (status === 400) return "bad_request";
  return "error";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let _client: HiggsfieldCloudClient | null = null;
export function cloudClient(): HiggsfieldCloudClient {
  if (!_client) _client = new HiggsfieldCloudClient();
  return _client;
}

export function resetCloudClient(): void {
  _client = null;
  log.debug("cloud client reset");
}
