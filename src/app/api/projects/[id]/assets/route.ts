import path from "node:path";
import fs from "node:fs/promises";
import { route, json, db, query, list, num } from "@/server/http";
import { ingestUpload, listAssets } from "@/server/assets";
import { tmpFile, safeFilename } from "@/lib/files";
import { badRequest } from "@/server/errors";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (req, { params }) => {
  const sp = query(req);
  return json(listAssets(db(), { projectId: params.id, role: list(sp, "role"), kind: list(sp, "kind"), tag: sp.get("tag") ?? undefined, search: sp.get("q") ?? undefined, limit: num(sp, "limit"), offset: num(sp, "offset") }));
});

/** multipart/form-data with one or more `files`; optional `role`. Ingests synchronously (images are normalized). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const form = await req.formData();
  const role = (form.get("role") as string | null) ?? "upload";
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) throw badRequest("No files uploaded");
  const out = [];
  for (const f of files) {
    const tmp = tmpFile(path.extname(f.name) || ".bin");
    await fs.writeFile(tmp, Buffer.from(await f.arrayBuffer()));
    out.push(await ingestUpload(db(), params.id, tmp, safeFilename(f.name), role));
  }
  return json({ items: out }, 201);
});
