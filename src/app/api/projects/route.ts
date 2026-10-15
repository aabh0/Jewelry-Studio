import { route, json, db, body, query } from "@/server/http";
import { listProjects, createProject, zProjectInput } from "@/server/projects";

export const dynamic = "force-dynamic";
export const GET = route(async (req) => json({ items: listProjects(db(), query(req).get("archived") === "1") }));
export const POST = route(async (req) => json(createProject(db(), await body(req, zProjectInput)), 201));
