"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, FolderOpen, Images, ListChecks, Settings, Search, Sun, Moon, Loader2, Check, AlertTriangle, CloudOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/tooltip";
import { useEventStream } from "@/hooks/use-events";
import { useGet } from "@/hooks/use-api";
import { saveState } from "@/hooks/use-api";
import { formatUsd } from "@/lib/money";
import { CommandPalette } from "./command-palette";
import { ProjectSwitcher } from "./project-switcher";
import { Kbd } from "@/components/ui/controls";

const RAIL = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/projects", icon: FolderOpen, label: "Projects" },
  { href: "/library", icon: Images, label: "Library" },
  { href: "/jobs", icon: ListChecks, label: "Jobs" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const connected = useEventStream();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");
  const [save, setSave] = React.useState(saveState.get());
  React.useEffect(() => saveState.subscribe(setSave), []);
  React.useEffect(() => { try { if (localStorage.getItem("js-theme") === "light") setTheme("light"); } catch { /* ignore */ } }, []);
  const toggleTheme = () => { const t = theme === "dark" ? "light" : "dark"; setTheme(t); document.documentElement.setAttribute("data-theme", t); try { localStorage.setItem("js-theme", t); } catch { /* ignore */ } };
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
      if (mod && e.key.toLowerCase() === "p") { e.preventDefault(); setSwitcherOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const health = useGet<{ lanes: { cloud: { available: boolean }; cli: { available: boolean; state: string }; claude: { available: boolean } }; spendToday: number; activeJobs: number; mock: boolean }>("/api/health", { refetchInterval: 15_000 });
  const projectId = /^\/projects\/([^/]+)/.exec(pathname)?.[1];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg-0 text-fg-0">
      <nav className="flex w-16 shrink-0 flex-col items-center border-r border-line bg-bg-1 py-3 gap-1">
        <Link href="/" className="mb-3 flex size-9 items-center justify-center rounded-[10px] bg-accent text-accent-fg font-display text-[20px] leading-none">J</Link>
        {RAIL.map((r) => {
          const active = r.href === "/" ? pathname === "/" : pathname.startsWith(r.href);
          return (
            <Tooltip key={r.href} content={r.label} side="right">
              <Link href={r.href} className={cn("flex size-10 items-center justify-center rounded-[10px] text-fg-2 transition-colors hover:bg-bg-2 hover:text-fg-0", active && "bg-bg-3 text-fg-0")} aria-label={r.label}>
                <r.icon className="size-[18px]" />
              </Link>
            </Tooltip>
          );
        })}
        <div className="flex-1" />
        <Tooltip content={theme === "dark" ? "Light theme" : "Dark theme"} side="right">
          <button onClick={toggleTheme} className="flex size-10 items-center justify-center rounded-[10px] text-fg-2 hover:bg-bg-2 hover:text-fg-0 cursor-pointer" aria-label="Toggle theme">{theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}</button>
        </Tooltip>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-bg-1 px-4">
          <Breadcrumbs pathname={pathname} />
          <div className="flex-1" />
          <button onClick={() => setSwitcherOpen(true)} className="hidden md:flex items-center gap-2 h-8 px-3 rounded-[var(--radius-sm)] text-[12px] text-fg-1 hover:text-fg-0 hover:bg-bg-2 cursor-pointer hairline">
            <FolderOpen className="size-3.5" /> Switch project <Kbd>⌘P</Kbd>
          </button>
          <button onClick={() => setPaletteOpen(true)} className="flex items-center gap-2 h-8 px-3 rounded-[var(--radius-sm)] text-[12px] text-fg-1 hover:text-fg-0 hover:bg-bg-2 cursor-pointer hairline">
            <Search className="size-3.5" /> <span className="hidden md:inline">Search &amp; actions</span> <Kbd>⌘K</Kbd>
          </button>
          <SaveIndicator state={save} />
          <Link href="/jobs" className="flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[12px] text-fg-1 hover:text-fg-0 hover:bg-bg-2 hairline">
            {health.data && health.data.activeJobs > 0 ? <Loader2 className="size-3.5 animate-spin text-accent" /> : <Check className="size-3.5 text-fg-3" />}
            <span className="tabular">{health.data?.activeJobs ?? 0} running</span>
          </Link>
          <span className="text-[12px] text-fg-2 tabular hidden lg:inline" title="Spend today">{formatUsd(health.data?.spendToday)} today</span>
          <div className="flex items-center gap-1">
            <LaneDot ok={!!health.data?.lanes.cloud.available} label="Cloud API" />
            <LaneDot ok={!!health.data?.lanes.cli.available} label={`Higgsfield CLI (${health.data?.lanes.cli.state ?? "…"})`} />
            <LaneDot ok={!!health.data?.lanes.claude.available} label="Claude" />
            {health.data?.mock ? <span className="ml-1 text-[10px] uppercase tracking-wide text-warn">mock</span> : null}
            {!connected ? <Tooltip content="Live updates reconnecting"><CloudOff className="ml-1 size-3.5 text-warn" /></Tooltip> : null}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} projectId={projectId} onNavigate={(h) => { setPaletteOpen(false); router.push(h); }} onToggleTheme={toggleTheme} />
      <ProjectSwitcher open={switcherOpen} onOpenChange={setSwitcherOpen} onNavigate={(h) => { setSwitcherOpen(false); router.push(h); }} />
    </div>
  );
}

function LaneDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Tooltip content={label}>
      <span className={cn("block size-2 rounded-full", ok ? "bg-ok" : "bg-fg-3")} aria-label={label} />
    </Tooltip>
  );
}

function SaveIndicator({ state }: { state: "saved" | "dirty" | "saving" | "error" }) {
  const map = { saved: { icon: Check, text: "Saved", cls: "text-fg-3" }, dirty: { icon: Loader2, text: "Saving…", cls: "text-fg-2" }, saving: { icon: Loader2, text: "Saving…", cls: "text-fg-2" }, error: { icon: AlertTriangle, text: "Retrying", cls: "text-warn" } } as const;
  const m = map[state];
  return (
    <span className={cn("flex items-center gap-1 text-[11px]", m.cls)}>
      <m.icon className={cn("size-3", state === "saving" || state === "dirty" ? "animate-spin" : "")} /> {m.text}
    </span>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const projectId = /^\/projects\/([^/]+)/.exec(pathname)?.[1];
  const notNew = (v: string | undefined) => (v && v !== "new" ? v : undefined);
  const campaignId = notNew(/\/campaigns\/([^/]+)/.exec(pathname)?.[1]);
  const productId = notNew(/\/products\/([^/]+)/.exec(pathname)?.[1]);
  const talentId = notNew(/\/talent\/([^/]+)/.exec(pathname)?.[1]);
  const project = useGet<{ name: string }>(projectId ? `/api/projects/${projectId}` : null);
  const campaign = useGet<{ name: string }>(campaignId ? `/api/campaigns/${campaignId}` : null);
  const product = useGet<{ name: string }>(productId ? `/api/products/${productId}` : null);
  const talent = useGet<{ name: string }>(talentId ? `/api/talent/${talentId}` : null);
  const stage = pathname.split("/").pop();
  const crumbs: { href: string; label: string }[] = [];
  if (projectId) crumbs.push({ href: `/projects/${projectId}`, label: project.data?.name ?? "Project" });
  if (campaignId) crumbs.push({ href: `/projects/${projectId}/campaigns/${campaignId}`, label: campaign.data?.name ?? "Campaign" });
  if (productId) crumbs.push({ href: pathname, label: product.data?.name ?? "Product" });
  if (talentId) crumbs.push({ href: pathname, label: talent.data?.name ?? "Talent" });
  const leaf = pathname.split("/").slice(-2);
  if (leaf[1] === "new") crumbs.push({ href: pathname, label: leaf[0] === "products" ? "New product" : leaf[0] === "talent" ? "New person" : "New campaign" });
  if (campaignId && stage && !["campaigns", campaignId].includes(stage)) crumbs.push({ href: pathname, label: stage[0].toUpperCase() + stage.slice(1) });
  if (crumbs.length === 0) {
    const top = pathname === "/" ? "Home" : pathname.slice(1).split("/")[0];
    return <span className="text-[13px] text-fg-0 capitalize">{top}</span>;
  }
  return (
    <nav className="flex items-center gap-1.5 text-[13px] min-w-0">
      {crumbs.map((c, i) => (
        <React.Fragment key={c.href + i}>
          {i > 0 ? <span className="text-fg-3">›</span> : null}
          <Link href={c.href} className={cn("truncate max-w-[220px]", i === crumbs.length - 1 ? "text-fg-0" : "text-fg-1 hover:text-fg-0")}>{c.label}</Link>
        </React.Fragment>
      ))}
    </nav>
  );
}
