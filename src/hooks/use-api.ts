"use client";
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function useGet<T>(url: string | null, opts: Partial<UseQueryOptions<T>> = {}) {
  return useQuery<T>({ queryKey: [url], queryFn: () => api.get<T>(url!), enabled: !!url, staleTime: 5_000, ...opts });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return useCallback((prefixes: string[]) => { for (const p of prefixes) void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith(p) }); }, [qc]);
}

/** Generic mutation with error toast and invalidation. */
export function useAction<TArgs, TRes = unknown>(fn: (args: TArgs) => Promise<TRes>, opts: { invalidate?: string[]; success?: string | ((r: TRes) => string | undefined); onSuccess?: (r: TRes, args: TArgs) => void } = {}) {
  const inv = useInvalidate();
  return useMutation<TRes, Error, TArgs>({
    mutationFn: fn,
    onSuccess: (r, args) => {
      if (opts.invalidate) inv(opts.invalidate);
      const msg = typeof opts.success === "function" ? opts.success(r) : opts.success;
      if (msg) toast.success(msg);
      opts.onSuccess?.(r, args);
    },
    onError: (e) => toast.error(e.message),
  });
}

/** Debounced autosave: call `save(patch)`; writes are coalesced (≤500ms) and flushed on unload. Tracks saving state in a global store. */
export function useAutosave<T extends object>(persist: (patch: Partial<T>) => Promise<unknown>, delay = 500) {
  const pending = useRef<Partial<T>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<() => Promise<void>>(async () => {});
  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    saveState.set("saving");
    try { await persist(patch); saveState.set("saved"); } catch (e) { saveState.set("error"); toast.error(`Could not save: ${(e as Error).message}`); pending.current = { ...patch, ...pending.current }; setTimeout(() => void retry.current(), 3000); }
  }, [persist]);
  useEffect(() => { retry.current = flush; }, [flush]);
  const save = useCallback((patch: Partial<T>) => {
    pending.current = { ...pending.current, ...patch };
    saveState.set("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
  }, [flush, delay]);
  useEffect(() => {
    const onHide = () => { if (Object.keys(pending.current).length) void flush(); };
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => { window.removeEventListener("beforeunload", onHide); document.removeEventListener("visibilitychange", onHide); if (Object.keys(pending.current).length) void flush(); };
  }, [flush]);
  return { save, flush };
}

type SaveStatus = "saved" | "dirty" | "saving" | "error";
const listeners = new Set<(s: SaveStatus) => void>();
let current: SaveStatus = "saved";
export const saveState = {
  get: () => current,
  set: (s: SaveStatus) => { current = s; listeners.forEach((l) => l(s)); },
  subscribe: (l: (s: SaveStatus) => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};
