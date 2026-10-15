"use client";
import * as React from "react";
import { mediaUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Repeat } from "lucide-react";
import { cn } from "@/lib/cn";

export function VideoPlayer({ pathRel, className, autoPlay = false, loop = true, fps = 30, poster }: { pathRel: string; className?: string; autoPlay?: boolean; loop?: boolean; fps?: number; poster?: string }) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(autoPlay);
  const [loopOn, setLoopOn] = React.useState(loop);
  const [t, setT] = React.useState(0);
  const [d, setD] = React.useState(0);
  const step = (n: number) => { const v = ref.current; if (!v) return; v.pause(); v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + n / fps)); };
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === " ") { e.preventDefault(); const v = ref.current; if (!v) return; if (v.paused) void v.play(); else v.pause(); }
      if (e.key === ",") step(-1);
      if (e.key === ".") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className={cn("group relative overflow-hidden rounded-[var(--radius-md)] bg-black", className)}>
      <video ref={ref} src={mediaUrl(pathRel)} poster={poster} className="block h-full w-full object-contain" autoPlay={autoPlay} loop={loopOn} muted playsInline onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setD(e.currentTarget.duration)} onClick={() => { const v = ref.current; if (!v) return; if (v.paused) void v.play(); else v.pause(); }} />
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <Button size="icon-sm" variant="ghost" className="text-white" onClick={() => step(-1)} aria-label="Previous frame"><SkipBack /></Button>
        <Button size="icon-sm" variant="ghost" className="text-white" onClick={() => { const v = ref.current; if (!v) return; if (v.paused) void v.play(); else v.pause(); }} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause /> : <Play />}</Button>
        <Button size="icon-sm" variant="ghost" className="text-white" onClick={() => step(1)} aria-label="Next frame"><SkipForward /></Button>
        <input type="range" min={0} max={d || 0} step={0.01} value={t} onChange={(e) => { if (ref.current) ref.current.currentTime = Number(e.target.value); }} className="mx-2 flex-1 accent-[var(--accent)]" aria-label="Scrub" />
        <span className="tabular text-[11px] text-white/80">{t.toFixed(2)} / {d.toFixed(2)}s</span>
        <Button size="icon-sm" variant="ghost" className={cn("text-white", loopOn && "text-accent")} onClick={() => setLoopOn((l) => !l)} aria-label="Loop"><Repeat /></Button>
      </div>
    </div>
  );
}
