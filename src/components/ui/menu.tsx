"use client";
import * as React from "react";
import { DropdownMenu as DM, Popover as P } from "radix-ui";
import { cn } from "@/lib/cn";

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({ className, align = "end", ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content align={align} sideOffset={6} className={cn("z-50 min-w-[180px] rounded-[var(--radius-md)] bg-bg-2 p-1 shadow-float hairline animate-in fade-in-0 zoom-in-95 duration-[var(--dur-micro)]", className)} {...props} />
    </DM.Portal>
  );
}

export function MenuItem({ className, danger, shortcut, children, ...props }: React.ComponentProps<typeof DM.Item> & { danger?: boolean; shortcut?: string }) {
  return (
    <DM.Item className={cn("flex items-center gap-2 rounded-[var(--radius-sm)] px-2 h-8 text-[13px] text-fg-0 outline-none cursor-pointer data-[highlighted]:bg-bg-3 data-[disabled]:opacity-40 [&_svg]:size-4 [&_svg]:text-fg-2", danger && "text-danger", className)} {...props}>
      <span className="flex-1 truncate">{children}</span>
      {shortcut ? <kbd className="text-[10px] font-mono text-fg-2">{shortcut}</kbd> : null}
    </DM.Item>
  );
}
export function MenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-line" />;
}
export const MenuLabel = ({ children }: { children: React.ReactNode }) => <div className="px-2 py-1 text-[11px] text-fg-2 uppercase tracking-wide">{children}</div>;

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export function PopoverContent({ className, align = "start", ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={6} className={cn("z-50 rounded-[var(--radius-md)] bg-bg-2 p-3 shadow-float hairline animate-in fade-in-0 zoom-in-95 duration-[var(--dur-micro)] outline-none", className)} {...props} />
    </P.Portal>
  );
}
