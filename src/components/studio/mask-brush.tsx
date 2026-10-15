"use client";
import * as React from "react";
import { Stage, Layer, Image as KImage, Line } from "react-konva";
import type Konva from "konva";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/controls";
import { Eraser, Paintbrush, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface Stroke { points: number[]; size: number; erase: boolean }

/** Paint a mask over an image; exports a PNG mask at the source resolution (white = edit). */
export function MaskBrush({ src, width: srcW, height: srcH, onExport, className }: { src: string; width: number; height: number; onExport: (maskBlob: Blob) => void; className?: string }) {
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const [strokes, setStrokes] = React.useState<Stroke[]>([]);
  const [size, setSize] = React.useState(40);
  const [erase, setErase] = React.useState(false);
  const drawing = React.useRef(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(el.clientWidth / srcW, 560 / srcH, 1)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [srcW, srcH]);
  const pos = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => { const p = e.target.getStage()?.getPointerPosition(); return p ? [p.x / scale, p.y / scale] : null; };
  const start = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => { const p = pos(e); if (!p) return; drawing.current = true; setStrokes((s) => [...s, { points: p, size, erase }]); };
  const move = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => { if (!drawing.current) return; const p = pos(e); if (!p) return; setStrokes((s) => { const last = s[s.length - 1]; return [...s.slice(0, -1), { ...last, points: [...last.points, ...p] }]; }); };
  const end = () => { drawing.current = false; };
  const exportMask = () => {
    const c = document.createElement("canvas");
    c.width = srcW; c.height = srcH;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, srcW, srcH);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const s of strokes) {
      ctx.strokeStyle = s.erase ? "#000" : "#fff"; ctx.lineWidth = s.size;
      ctx.beginPath();
      for (let i = 0; i < s.points.length; i += 2) { if (i === 0) ctx.moveTo(s.points[0], s.points[1]); else ctx.lineTo(s.points[i], s.points[i + 1]); }
      if (s.points.length === 2) { ctx.arc(s.points[0], s.points[1], s.size / 2, 0, Math.PI * 2); ctx.fillStyle = s.erase ? "#000" : "#fff"; ctx.fill(); }
      ctx.stroke();
    }
    c.toBlob((b) => b && onExport(b), "image/png");
  };
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Button size="sm" variant={erase ? "secondary" : "primary"} onClick={() => setErase(false)}><Paintbrush /> Paint</Button>
        <Button size="sm" variant={erase ? "primary" : "secondary"} onClick={() => setErase(true)}><Eraser /> Erase</Button>
        <Button size="sm" variant="ghost" onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={strokes.length === 0}><Undo2 /> Undo</Button>
        <div className="flex items-center gap-2 ml-2 w-44"><span className="text-[11px] text-fg-2">Size</span><Slider min={4} max={200} value={[size]} onValueChange={(v) => setSize(v[0])} /></div>
        <div className="flex-1" />
        <Button size="sm" variant="primary" onClick={exportMask} disabled={strokes.length === 0}>Use mask</Button>
      </div>
      <div ref={containerRef} className="overflow-hidden rounded-[var(--radius-md)] bg-bg-2" style={{ height: srcH * scale }}>
        <Stage width={srcW * scale} height={srcH * scale} scaleX={scale} scaleY={scale} onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} className="cursor-crosshair">
          <Layer>{img ? <KImage image={img} width={srcW} height={srcH} /> : null}</Layer>
          <Layer opacity={0.55}>
            {strokes.map((s, i) => <Line key={i} points={s.points} stroke={s.erase ? "#000" : "#D4B27A"} strokeWidth={s.size} lineCap="round" lineJoin="round" globalCompositeOperation={s.erase ? "destination-out" : "source-over"} />)}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
