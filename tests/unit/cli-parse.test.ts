import { describe, it, expect } from "vitest";
import { parseCliJson, extractResultUrls } from "@/providers/higgsfield/cli/parse";

describe("cli parse", () => {
  it("parses json after progress noise", () => {
    const out = `Waiting... 10%\nWaiting... 50%\n[{"id":"j1","status":"completed","result_url":"https://cdn.x/y.png"}]`;
    const j = parseCliJson(out);
    expect(Array.isArray(j)).toBe(true);
    expect(extractResultUrls(j)).toEqual(["https://cdn.x/y.png"]);
  });
  it("finds nested media urls and ignores non-media", () => {
    const j = { outputs: [{ url: "https://cdn/a.mp4" }, { url: "https://cdn/page.html" }], meta: { thumb: "https://cdn/t.jpg" } };
    expect(extractResultUrls(j)).toEqual(["https://cdn/a.mp4", "https://cdn/t.jpg"]);
  });
});
