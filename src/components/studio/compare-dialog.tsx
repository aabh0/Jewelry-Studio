"use client";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { mediaUrl } from "@/lib/api";
import { VideoPlayer } from "./video-player";

export function CompareDialog({ open, onOpenChange, a, b, labels }: { open: boolean; onOpenChange: (o: boolean) => void; a: { pathRel: string; kind: string } | null; b: { pathRel: string; kind: string } | null; labels?: [string, string] }) {
  if (!a || !b) return null;
  const video = a.kind === "video" || b.kind === "video";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide title="Compare" description={labels ? `${labels[0]} vs ${labels[1]}` : undefined}>
        {video ? (
          <div className="grid grid-cols-2 gap-3">
            <VideoPlayer pathRel={a.pathRel} className="aspect-[9/16] max-h-[60vh]" autoPlay />
            <VideoPlayer pathRel={b.pathRel} className="aspect-[9/16] max-h-[60vh]" autoPlay />
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-hidden rounded-[var(--radius-md)]">
            <ReactCompareSlider itemOne={<ReactCompareSliderImage src={mediaUrl(a.pathRel)} alt={labels?.[0] ?? "A"} />} itemTwo={<ReactCompareSliderImage src={mediaUrl(b.pathRel)} alt={labels?.[1] ?? "B"} />} style={{ maxHeight: "70vh" }} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
