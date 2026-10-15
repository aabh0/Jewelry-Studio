"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { rememberProject } from "@/hooks/use-ui-state";

/** Persists the current route per project so the switcher and Home can resume it. */
export function RememberRoute({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  useEffect(() => {
    rememberProject(projectId);
  }, [projectId]);
  useEffect(() => {
    // Sent immediately and with keepalive so the route survives a tab closed right after navigating.
    void api.put(`/api/ui-state/${encodeURIComponent(`project:${projectId}`)}`, { data: { last_route: pathname, last_at: Date.now() }, merge: true }, { keepalive: true }).catch(() => {});
  }, [pathname, projectId]);
  return null;
}
