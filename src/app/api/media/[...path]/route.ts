import fs from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { absPath, mimeFor } from "@/lib/files";
import { boot } from "@/server/http";

export const dynamic = "force-dynamic";

async function serve(req: NextRequest, segments: string[], head = false): Promise<Response> {
  boot();
  let abs: string;
  try {
    abs = absPath(segments.map(decodeURIComponent).join("/"));
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  let st;
  try {
    st = await stat(abs);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!st.isFile()) return new Response("Not found", { status: 404 });
  const mime = mimeFor(abs);
  const etag = `"${st.size}-${Math.round(st.mtimeMs)}"`;
  const baseHeaders: Record<string, string> = { "Content-Type": mime, "Accept-Ranges": "bytes", ETag: etag, "Last-Modified": st.mtime.toUTCString(), "Cache-Control": "private, max-age=3600" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: baseHeaders });
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (!m[1] && m[2]) { start = Math.max(0, st.size - parseInt(m[2], 10)); end = st.size - 1; }
      if (start >= st.size || end >= st.size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${st.size}` } });
      end = Math.min(end, start + 8 * 1024 * 1024 - 1);
      const headers = { ...baseHeaders, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": String(end - start + 1) };
      if (head) return new Response(null, { status: 206, headers });
      const stream = Readable.toWeb(fs.createReadStream(abs, { start, end })) as ReadableStream;
      return new Response(stream, { status: 206, headers });
    }
  }
  const headers = { ...baseHeaders, "Content-Length": String(st.size) };
  if (head) return new Response(null, { status: 200, headers });
  const stream = Readable.toWeb(fs.createReadStream(abs)) as ReadableStream;
  return new Response(stream, { status: 200, headers });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return serve(req, path);
}
export async function HEAD(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return serve(req, path, true);
}
