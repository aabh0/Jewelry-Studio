"use client";
import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn("h-8 w-full rounded-[var(--radius-sm)] bg-bg-2 px-2.5 text-[13px] text-fg-0 placeholder:text-fg-3 hairline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 transition-shadow", className)}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn("min-h-[88px] w-full rounded-[var(--radius-sm)] bg-bg-2 px-2.5 py-2 text-[13px] leading-relaxed text-fg-0 placeholder:text-fg-3 hairline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 resize-y", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-[12px] font-medium text-fg-1 mb-1.5", className)} {...props} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-fg-2">{hint}</p> : null}
    </div>
  );
}

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn("h-8 w-full appearance-none rounded-[var(--radius-sm)] bg-bg-2 pl-2.5 pr-8 text-[13px] text-fg-0 hairline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50", className)}
      {...props}
    >
      {children}
    </select>
    <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-fg-2" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>
  </div>
));
Select.displayName = "Select";
