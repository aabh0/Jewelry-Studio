import { route, json, db } from "@/server/http";
import { spendSummary } from "@/server/settings";
export const dynamic = "force-dynamic";
export const GET = route(async () => json(spendSummary(db())));
