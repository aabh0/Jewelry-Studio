"use client";
import * as React from "react";
import { Tooltip as T } from "radix-ui";
import { cn } from "@/lib/cn";

export const TooltipProvider = T.Provider;

export function Tooltip({ content, children, side = "bottom", shortcut }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right"; shortcut?: string }) {
  if (!content) return <>{children}</>;
  return (
    <T.Root delayDuration={350}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className={cn("z-[60] rounded-[var(--radius-sm)] bg-bg-3 px-2 py-1 text-[12px] text-fg-0 shadow-float hairline animate-in fade-in-0 zoom-in-95 duration-[var(--dur-micro)] flex items-center gap-2")}>
          {content}
          {shortcut ? <kbd className="rounded bg-bg-4 px-1 text-[10px] text-fg-1 font-mono">{shortcut}</kbd> : null}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
