"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface JobEvent {
  id: number;
  job_id: string;
  ts: number;
  kind: "progress" | "log" | "status" | "artifact" | "cost";
  data: Record<string, unknown>;
  project_id: string | null;
  job_type: string;
  job_status: string;
}

type Listener = (e: JobEvent) => void;
const listeners = new Set<Listener>();
export function onJobEvent(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** One SSE connection per tab; invalidates queries on job status changes and artifacts. */
export function useEventStream() {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const lastId = useRef<number | null>(null);
  useEffect(() => {
    let es: EventSource | null = null;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      const url = lastId.current ? `/api/events?since=${lastId.current}` : "/api/events";
      es = new EventSource(url);
      es.onopen = () => setConnected(true);
      es.onerror = () => { setConnected(false); es?.close(); if (!stopped) setTimeout(connect, 2000); };
      es.addEventListener("job", (ev) => {
        const e = JSON.parse((ev as MessageEvent).data) as JobEvent;
        lastId.current = e.id;
        listeners.forEach((l) => l(e));
        if (e.kind === "status" || e.kind === "artifact") {
          void qc.invalidateQueries({ predicate: (q) => { const k = q.queryKey[0]; return typeof k === "string" && (k.startsWith("/api/jobs") || k.startsWith("/api/campaigns") || k.startsWith("/api/products") || k.startsWith("/api/talent") || k.startsWith("/api/projects") || k.startsWith("/api/assets") || k.startsWith("/api/ledger") || k.startsWith("/api/health") || k.startsWith("/api/edits")); } });
        }
        if (e.kind === "status" && e.data.status === "failed") toast.error(`Job failed: ${String(e.data.message ?? "").slice(0, 140)}`, { duration: 8000 });
      });
    };
    connect();
    return () => { stopped = true; es?.close(); };
  }, [qc]);
  return connected;
}
