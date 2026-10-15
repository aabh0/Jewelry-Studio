"use client";
import * as React from "react";
import { Switch as S, Slider as Sl, Tabs as T, Progress as Pr, Checkbox as Cb } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root className={cn("relative h-5 w-9 rounded-full bg-bg-4 data-[state=checked]:bg-accent transition-colors cursor-pointer disabled:opacity-40", className)} {...props}>
      <S.Thumb className="block size-4 translate-x-0.5 rounded-full bg-fg-0 data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-fg transition-transform duration-[var(--dur-micro)] ease-[var(--ease)]" />
    </S.Root>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof Cb.Root>) {
  return (
    <Cb.Root className={cn("size-4 rounded-[4px] hairline bg-bg-2 data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg flex items-center justify-center cursor-pointer", className)} {...props}>
      <Cb.Indicator>
        <Check className="size-3" strokeWidth={3} />
      </Cb.Indicator>
    </Cb.Root>
  );
}

export function Slider({ className, ...props }: React.ComponentProps<typeof Sl.Root>) {
  return (
    <Sl.Root className={cn("relative flex h-5 w-full touch-none select-none items-center", className)} {...props}>
      <Sl.Track className="relative h-1 w-full grow rounded-full bg-bg-4">
        <Sl.Range className="absolute h-full rounded-full bg-accent" />
      </Sl.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
        <Sl.Thumb key={i} className="block size-3.5 rounded-full bg-fg-0 shadow hover:scale-110 transition-transform cursor-grab active:cursor-grabbing" />
      ))}
    </Sl.Root>
  );
}

export const Tabs = T.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] bg-bg-2 p-0.5 hairline", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return <T.Trigger className={cn("h-7 rounded-[5px] px-3 text-[12px] font-medium text-fg-1 data-[state=active]:bg-bg-3 data-[state=active]:text-fg-0 transition-colors cursor-pointer", className)} {...props} />;
}
export const TabsContent = T.Content;

export function Progress({ value, className, tone = "accent" }: { value: number | null | undefined; className?: string; tone?: "accent" | "ok" | "danger" }) {
  const v = value === null || value === undefined ? null : Math.max(0, Math.min(100, value));
  return (
    <Pr.Root className={cn("relative h-1 w-full overflow-hidden rounded-full bg-bg-4", className)} value={v ?? undefined}>
      <Pr.Indicator
        className={cn("h-full rounded-full transition-[width] duration-300 ease-[var(--ease)]", tone === "ok" ? "bg-ok" : tone === "danger" ? "bg-danger" : "bg-accent", v === null && "animate-pulse w-1/3")}
        style={v === null ? undefined : { width: `${v}%` }}
      />
    </Pr.Root>
  );
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return <div className={cn(vertical ? "w-px self-stretch bg-line" : "h-px w-full bg-line", className)} />;
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton", className)} style={style} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-bg-3 px-1 text-[10px] font-mono text-fg-1 hairline">{children}</kbd>;
}
