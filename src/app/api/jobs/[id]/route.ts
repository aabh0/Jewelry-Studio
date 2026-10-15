import { route, json, db } from "@/server/http";
import { getJob } from "@/server/jobs";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json(getJob(db(), params.id)));
