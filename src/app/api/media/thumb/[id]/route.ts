import fs from "node:fs";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { db, errorResponse } from "@/server/http";
import { ensureThumb } from "@/server/assets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const w = Math.min(2048, Math.max(64, Number(req.nextUrl.searchParams.get("w") ?? 512)));
    const file = await ensureThumb(db(), id, w);
    const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
    return new Response(stream, { status: 200, headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=31536000, immutable" } });
  } catch (err) {
    return errorResponse(err);
  }
}
