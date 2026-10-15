"use client";
import * as React from "react";
import { Command as C } from "cmdk";
import { Dialog as D } from "radix-ui";
import { cn } from "@/lib/cn";

export function CommandDialog({ open, onOpenChange, children, placeholder = "Search projects, campaigns, actions…" }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode; placeholder?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <D.Content className="fixed left-1/2 top-[18vh] z-50 w-[calc(100vw-32px)] max-w-[640px] -translate-x-1/2 rounded-[var(--radius-lg)] bg-bg-1 shadow-float hairline overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] duration-[var(--dur-std)]">
          <D.Title className="sr-only">Command palette</D.Title>
          <C label="Command palette" className="flex flex-col">
            <C.Input placeholder={placeholder} className="h-12 w-full bg-transparent px-4 text-[15px] text-fg-0 placeholder:text-fg-3 outline-none border-b border-line" />
            <C.List className="max-h-[50vh] overflow-y-auto scrollbar-thin p-2">
              <C.Empty className="py-8 text-center text-[13px] text-fg-2">Nothing matches.</C.Empty>
              {children}
            </C.List>
          </C>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function CommandGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <C.Group heading={heading} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-fg-2">
      {children}
    </C.Group>
  );
}

export function CommandItem({ className, children, hint, ...props }: React.ComponentProps<typeof C.Item> & { hint?: string }) {
  return (
    <C.Item className={cn("flex items-center gap-3 rounded-[var(--radius-sm)] px-2 h-9 text-[13px] text-fg-0 cursor-pointer data-[selected=true]:bg-bg-3 [&_svg]:size-4 [&_svg]:text-fg-2", className)} {...props}>
      <span className="flex-1 truncate">{children}</span>
      {hint ? <span className="text-[11px] text-fg-2">{hint}</span> : null}
    </C.Item>
  );
}
