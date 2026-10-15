"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, title, description, wide, ...props }: React.ComponentProps<typeof D.Content> & { title?: React.ReactNode; description?: React.ReactNode; wide?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-[var(--dur-large)]" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] bg-bg-1 p-6 shadow-float hairline data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-[var(--dur-large)]",
          wide ? "max-w-[960px]" : "max-w-[640px]",
          className,
        )}
        {...props}
      >
        {title ? <D.Title className="font-display text-[24px] leading-tight text-fg-0 pr-8">{title}</D.Title> : <D.Title className="sr-only">Dialog</D.Title>}
        {description ? <D.Description className="mt-1 text-[13px] text-fg-1">{description}</D.Description> : null}
        <div className={cn(title ? "mt-5" : "")}>{children}</div>
        <D.Close className="absolute right-4 top-4 rounded-full p-1.5 text-fg-2 hover:text-fg-0 hover:bg-bg-2 cursor-pointer" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex items-center justify-end gap-2", className)} {...props} />;
}

/** Right-side drawer built on the same primitive. */
export function Drawer({ className, children, title, width = 480, ...props }: React.ComponentProps<typeof D.Content> & { title?: React.ReactNode; width?: number }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-[var(--dur-std)]" />
      <D.Content
        style={{ width }}
        className={cn("fixed right-0 top-0 z-50 h-full max-w-[calc(100vw-64px)] bg-bg-1 shadow-float border-l border-line flex flex-col data-[state=open]:animate-in data-[state=open]:slide-in-from-right-4 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-4 data-[state=closed]:fade-out-0 duration-[var(--dur-std)]", className)}
        {...props}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-line shrink-0">
          <D.Title className="text-[14px] font-medium text-fg-0 truncate">{title ?? "Details"}</D.Title>
          <D.Close className="rounded-full p-1.5 text-fg-2 hover:text-fg-0 hover:bg-bg-2 cursor-pointer" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
