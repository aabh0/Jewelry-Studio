import { route, json, db, body } from "@/server/http";
import { getProject, updateProject, zProjectInput } from "@/server/projects";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json(getProject(db(), params.id)));
export const PATCH = route<{ id: string }>(async (req, { params }) => json(updateProject(db(), params.id, await body(req, zProjectInput.partial().extend({ archived: z.boolean().optional() })))));
export const DELETE = route<{ id: string }>(async (_req, { params }) => json(updateProject(db(), params.id, { archived: true })));
