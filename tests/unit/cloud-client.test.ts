import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { HiggsfieldCloudClient, outputUrls } from "@/providers/higgsfield/cloud/client";
import { CloudApiError } from "@/providers/higgsfield/cloud/types";

const BASE = "https://api.test.local";
let submits = 0;
let polls = 0;
const server = setupServer(
  http.post(`${BASE}/marketing-studio/image/flare`, async ({ request }) => {
    submits++;
    const idem = request.headers.get("Idempotency-Key");
    if (request.headers.get("Authorization") !== "Key k:s") return HttpResponse.json({ detail: "bad key" }, { status: 401 });
    return HttpResponse.json({ status: "queued", request_id: `req-${idem ?? submits}`, status_url: "x", cancel_url: "y" });
  }),
  http.get(`${BASE}/requests/:id/status`, ({ params }) => {
    polls++;
    if (polls < 3) return HttpResponse.json({ status: "in_progress", request_id: params.id });
    return HttpResponse.json({ status: "completed", request_id: params.id, images: [{ url: `${BASE}/cdn/out.png` }] });
  }),
  http.post(`${BASE}/estimate/marketing-studio/image/flare`, () => HttpResponse.json({ usd: "0.231" })),
  http.post(`${BASE}/estimate/bytedance/seedance-2.5/image-to-video`, () => HttpResponse.json({ pricing_description: "token metered" })),
  http.post(`${BASE}/files/generate-upload-url`, () => HttpResponse.json({ upload_url: `${BASE}/put`, public_url: `${BASE}/public/f.png`, upload_headers: { "content-type": "image/png", "x-amz-tagging": "retention=temporary" } })),
  http.put(`${BASE}/put`, ({ request }) => (request.headers.get("x-amz-tagging") === "retention=temporary" ? new HttpResponse(null, { status: 200 }) : new HttpResponse(null, { status: 400 }))),
  http.post(`${BASE}/alibaba/qwen-image-3/edit`, () => HttpResponse.json({ detail: [{ loc: ["body", "image_urls"], msg: "field required" }] }, { status: 422 })),
  http.post(`${BASE}/higgsfield-ai/soul/v2/standard`, () => HttpResponse.json({ detail: "concurrency limit reached" }, { status: 400 })),
);

beforeAll(() => server.listen());
afterEach(() => { submits = 0; polls = 0; });
afterAll(() => server.close());

describe("cloud client", () => {
  const c = new HiggsfieldCloudClient({ baseUrl: BASE, key: "k", secret: "s" });
  it("submits once with idempotency key and polls to completion", async () => {
    const s = await c.submit("marketing-studio/image/flare", { prompt: "x" }, { idempotencyKey: "abc" });
    expect(s.request_id).toBe("req-abc");
    const done = await c.waitFor(s.request_id, { timeoutMs: 10_000 });
    expect(done.status).toBe("completed");
    expect(outputUrls(done)).toEqual([`${BASE}/cdn/out.png`]);
    expect(submits).toBe(1);
  }, 20_000);
  it("estimates usd and handles formula pricing", async () => {
    expect((await c.estimate("marketing-studio/image/flare", {})).usd).toBe(0.231);
    const f = await c.estimate("bytedance/seedance-2.5/image-to-video", {});
    expect(f.usd).toBeNull();
    expect(f.description).toMatch(/token/);
  });
  it("uploads with echoed headers", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const p = path.join(os.tmpdir(), `up-${Date.now()}.png`);
    fs.writeFileSync(p, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(await c.uploadFile(p)).toBe(`${BASE}/public/f.png`);
  });
  it("classifies errors", async () => {
    await expect(c.submit("alibaba/qwen-image-3/edit", {})).rejects.toMatchObject({ code: "validation", retryable: false });
    await expect(c.submit("higgsfield-ai/soul/v2/standard", {})).rejects.toMatchObject({ code: "concurrency", retryable: true });
    const bad = new HiggsfieldCloudClient({ baseUrl: BASE, key: "wrong", secret: "s" });
    await expect(bad.submit("marketing-studio/image/flare", {})).rejects.toBeInstanceOf(CloudApiError);
  });
  it("reports missing credentials", () => {
    const none = new HiggsfieldCloudClient({ baseUrl: BASE, key: undefined, secret: undefined });
    expect(none.available).toBe(false);
  });
});
