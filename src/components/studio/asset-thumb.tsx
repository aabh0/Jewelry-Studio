"use client";
import * as React from "react";
import { cn } from "@/lib/cn";
import { thumbUrl } from "@/lib/api";
import { Play } from "lucide-react";

export interface AssetLite { id: string; kind: string; width?: number | null; height?: number | null; pathRel?: string; durationMs?: number | null }

/** Image/video thumbnail with reserved aspect box (no layout shift). */
export function AssetThumb({ asset, w = 512, className, aspect, onClick, selected, children, rounded = true, empty }: { asset: AssetLite | null | undefined; w?: number; className?: string; aspect?: number; onClick?: () => void; selected?: boolean; children?: React.ReactNode; rounded?: boolean; empty?: React.ReactNode }) {
  const ratio = aspect ?? (asset?.width && asset?.height ? asset.width / asset.height : 1);
  return (
    <div onClick={onClick} className={cn("relative overflow-hidden bg-bg-2", rounded && "rounded-[var(--radius-md)]", onClick && "cursor-pointer", selected && "ring-2 ring-accent", className)} style={{ aspectRatio: ratio }}>
      {asset ? (
        <img src={thumbUrl(asset.id, w)} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[var(--dur-std)]" />
      ) : empty ? (
        <div className="absolute inset-0 flex items-center justify-center text-fg-3">{empty}</div>
      ) : (
        <div className="absolute inset-0 skeleton" />
      )}
      {asset?.kind === "video" ? <div className="absolute left-2 bottom-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white"><Play className="size-3" /> {asset.durationMs ? `${(asset.durationMs / 1000).toFixed(1)}s` : "video"}</div> : null}
      {children}
    </div>
  );
}
