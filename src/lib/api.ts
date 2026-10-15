"use client";
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? "error", e?.message ?? `Request failed (${res.status})`, e?.details);
  }
  return json as T;
}

export const api = {
  get: <T>(url: string) => fetch(url, { cache: "no-store" }).then((r) => handle<T>(r)),
  post: <T>(url: string, body?: unknown) => fetch(url, { method: "POST", headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" }, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) }).then((r) => handle<T>(r)),
  patch: <T>(url: string, body: unknown) => fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => handle<T>(r)),
  put: <T>(url: string, body: unknown, opts: { keepalive?: boolean } = {}) => fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: opts.keepalive }).then((r) => handle<T>(r)),
  del: <T>(url: string) => fetch(url, { method: "DELETE" }).then((r) => handle<T>(r)),
};

export const mediaUrl = (pathRel: string | null | undefined) => (pathRel ? `/api/media/${pathRel.split("/").map(encodeURIComponent).join("/")}` : "");
export const thumbUrl = (assetId: string, w = 512) => `/api/media/thumb/${assetId}?w=${w}`;
