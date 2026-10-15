import * as React from "react";
import { cn } from "@/lib/cn";

export function EmptyState({ title, body, action, className }: { title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6 rise-in", className)}>
      <h3 className="font-display text-[28px] leading-tight text-fg-0">{title}</h3>
      {body ? <p className="mt-2 max-w-[420px] text-[13px] text-fg-1">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, details, action }: { title?: string; message: string; details?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-danger/10 p-4 text-[13px]">
      <div className="font-medium text-danger">{title}</div>
      <div className="mt-1 text-fg-0">{message}</div>
      {details ? (
        <details className="mt-2 text-fg-2">
          <summary className="cursor-pointer">Details</summary>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px]">{details}</pre>
        </details>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, right, className }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mb-3", className)}>
      <h2 className="font-display text-[22px] leading-none text-fg-0">{children}</h2>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}
