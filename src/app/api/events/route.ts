import type { NextRequest } from "next/server";
import { db, boot } from "@/server/http";
import { eventsSince, latestEventId } from "@/queue/events";

export const dynamic = "force-dynamic";

/** Server-Sent Events: tails job_events. Supports Last-Event-ID / ?since=. */
export async function GET(req: NextRequest) {
  boot();
  const d = db();
  const sinceParam = req.nextUrl.searchParams.get("since") ?? req.headers.get("last-event-id");
  const projectId = req.nextUrl.searchParams.get("project_id") ?? undefined;
  let since = sinceParam ? Number(sinceParam) : latestEventId(d);
  if (!Number.isFinite(since)) since = latestEventId(d);
  const encoder = new TextEncoder();
  let timer: NodeJS.Timeout | null = null;
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (s: string) => { if (!closed) controller.enqueue(encoder.encode(s)); };
      send(`retry: 2000\nevent: hello\ndata: ${JSON.stringify({ since })}\n\n`);
      const tick = () => {
        if (closed) return;
        try {
          const rows = eventsSince(d, since, 200, projectId);
          for (const r of rows) {
            since = r.id;
            send(`id: ${r.id}\nevent: job\ndata: ${JSON.stringify(r)}\n\n`);
          }
          if (rows.length === 0) send(`: ping\n\n`);
        } catch (e) {
          send(`event: error\ndata: ${JSON.stringify({ message: (e as Error).message })}\n\n`);
        }
        timer = setTimeout(tick, 400);
      };
      timer = setTimeout(tick, 50);
    },
    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
    },
  });
  req.signal.addEventListener("abort", () => { closed = true; if (timer) clearTimeout(timer); });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
