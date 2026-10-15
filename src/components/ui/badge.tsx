import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-bg-3 text-fg-1",
  accent: "bg-accent-muted text-accent-strong",
  ok: "bg-ok/15 text-ok",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
};

export function Badge({ tone = "neutral", className, children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", tones[tone], className)} {...props}>
      {children}
    </span>
  );
}

export function Chip({ active, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-active={active ? "true" : "false"}
      aria-pressed={active ? true : undefined}
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 h-7 text-[12px] font-medium hairline transition-colors cursor-pointer", active ? "bg-accent-muted text-accent-strong" : "text-fg-1 hover:text-fg-0 hover:bg-bg-2", className)}
      {...props}
    >
      {children}
    </button>
  );
}
