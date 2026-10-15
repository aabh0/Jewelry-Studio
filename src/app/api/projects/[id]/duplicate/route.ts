import { route, json, db } from "@/server/http";
import { duplicateProject } from "@/server/projects";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (_req, { params }) => json(duplicateProject(db(), params.id), 201));
