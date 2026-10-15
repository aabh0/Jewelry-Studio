import { route, json, db, query, list, num } from "@/server/http";
import { listCandidates } from "@/server/campaigns";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (req, { params }) => {
  const sp = query(req);
  return json(listCandidates(db(), { campaignId: params.id, stage: sp.get("stage") ?? undefined, shotId: sp.get("shot_id") ?? undefined, review: list(sp, "review"), verdict: list(sp, "verdict"), minScore: num(sp, "min_score"), flag: sp.get("flag") ?? undefined, lane: sp.get("lane") ?? undefined, model: sp.get("model") ?? undefined, sort: (sp.get("sort") as "score" | "newest" | "oldest" | null) ?? undefined, limit: num(sp, "limit"), offset: num(sp, "offset") }));
});
