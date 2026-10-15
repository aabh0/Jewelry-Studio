import { route, json, db, body } from "@/server/http";
import { reorderShots } from "@/server/campaigns";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const POST = route<{ id: string }>(async (req, { params }) => { const b = await body(req, z.object({ orderedIds: z.array(z.string()) })); return json(reorderShots(db(), params.id, b.orderedIds)); });
