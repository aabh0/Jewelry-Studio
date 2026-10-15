import { route, json, db } from "@/server/http";
import { resolveAll, CAPABILITIES, laneStatus } from "@/providers/capability";
import { capabilityOverrides } from "@/server/settings";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const d = db();
  if (force) await laneStatus(true);
  const resolved = await resolveAll(capabilityOverrides(d));
  return json({ lanes: await laneStatus(), capabilities: CAPABILITIES.map((c) => ({ id: c.id, label: c.label, optional: !!c.optional, implementations: c.implementations, resolved: resolved[c.id] })) });
});
