"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

/** Persisted per-scope UI state (filters, tabs, selection). Loads once, saves debounced. */
export function useUiState<T extends Record<string, unknown>>(scope: string, defaults: T): [T, (patch: Partial<T>) => void, boolean] {
  const [state, setState] = useState<T>(defaults);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<T>>({});
  useEffect(() => {
    let alive = true;
    api.get<{ data: Partial<T> | null }>(`/api/ui-state/${encodeURIComponent(scope)}`).then((r) => { if (alive) { setState((s) => ({ ...s, ...(r.data ?? {}) })); setLoaded(true); } }).catch(() => setLoaded(true));
    return () => { alive = false; };
  }, [scope]);
  const update = useCallback((patch: Partial<T>) => {
    setState((s) => ({ ...s, ...patch }));
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { const p = pending.current; pending.current = {}; void api.put(`/api/ui-state/${encodeURIComponent(scope)}`, { data: p, merge: true }).catch(() => {}); }, 400);
  }, [scope]);
  return [state, update, loaded];
}

export function rememberProject(projectId: string) {
  void api.post(`/api/projects/${projectId}/open`).catch(() => {});
  try { localStorage.setItem("js-last-project", projectId); } catch { /* ignore */ }
}
