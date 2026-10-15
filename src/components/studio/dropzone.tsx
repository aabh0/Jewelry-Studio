"use client";
import * as React from "react";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useInvalidate } from "@/hooks/use-api";

export interface UploadedAsset { id: string; kind: string; width: number | null; height: number | null; pathRel: string; originalName: string | null }

export function Dropzone({ projectId, role = "upload", accept = "image/*,video/*,audio/*", multiple = true, onUploaded, className, label = "Drop files or click to upload", compact }: { projectId: string; role?: string; accept?: string; multiple?: boolean; onUploaded?: (assets: UploadedAsset[]) => void; className?: string; label?: string; compact?: boolean }) {
  const [busy, setBusy] = React.useState(false);
  const [over, setOver] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const inv = useInvalidate();
  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("role", role);
      for (const f of list) fd.append("files", f);
      const r = await api.post<{ items: UploadedAsset[] }>(`/api/projects/${projectId}/assets`, fd);
      inv(["/api/projects", "/api/assets"]);
      onUploaded?.(r.items);
      toast.success(`${r.items.length} file${r.items.length > 1 ? "s" : ""} added`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void upload(e.dataTransfer.files); }}
      onClick={() => input.current?.click()}
      className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-line-strong text-[13px] text-fg-1 transition-colors hover:border-accent hover:text-fg-0", over && "border-accent bg-accent-muted", compact ? "h-10 px-3" : "h-28", className)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
      <span>{busy ? "Uploading…" : label}</span>
      <input ref={input} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
