import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { HttpError } from "./errors";
import { getDb } from "@/db/client";
import { log } from "@/lib/log";
import { ensureDataDirs, dirs } from "@/lib/files";

let booted = false;
export function boot() {
  if (booted) return;
  ensureDataDirs();
  booted = true;
}

export function db() {
  boot();
  return getDb();
}

export function json(data: unknown, init?: number | ResponseInit): NextResponse {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  if (err instanceof z.ZodError) return NextResponse.json({ error: { code: "validation", message: "Invalid input", details: err.issues } }, { status: 400 });
  const e = err as Error;
  log.error({ err: e?.message, stack: e?.stack }, "route error");
  return NextResponse.json({ error: { code: "internal", message: e?.message ?? "Internal error" } }, { status: 500 });
}

type Handler<P> = (req: NextRequest, ctx: { params: P }) => Promise<Response> | Response;

/** Wrap a route handler: resolves params, catches errors. */
export function route<P = Record<string, string>>(fn: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      boot();
      const params = await ctx.params;
      return await fn(req, { params });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function body<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T> {
  const raw = await req.json().catch(() => ({}));
  return schema.parse(raw);
}

export function query(req: NextRequest): URLSearchParams {
  return req.nextUrl.searchParams;
}

export function list(sp: URLSearchParams, key: string): string[] | undefined {
  const v = sp.getAll(key).flatMap((x) => x.split(",")).filter(Boolean);
  return v.length ? v : undefined;
}

export function num(sp: URLSearchParams, key: string): number | undefined {
  const v = sp.get(key);
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Signal the worker to poll immediately (cheap cross-process wake). */
export function wakeWorker(): void {
  try {
    const f = path.join(dirs.root(), "wake");
    fs.writeFileSync(f, String(Date.now()));
  } catch {
    /* ignore */
  }
}
