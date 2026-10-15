// PLAN.md §27.4 — stop mid-generation, relaunch, jump between projects, nothing lost, nothing double-billed.
import { test, expect, chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServers, api, waitJob, browserLaunchOptions } from "./harness";

const PORT = 3124;

test("resume after a crash mid-generation keeps work, jobs and ledger intact", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "js-e2e-"));
  // Slow mock outputs so the kill lands mid-generation.
  let s = await startServers(dataDir, PORT, { MOCK_LATENCY_MS: "4000" });
  const base = s.base;

  // 1. Project A: product, image campaign, planned shots, generation of 6 shots.
  const A = await api<{ id: string }>(base, "POST", "/api/projects", { name: "Resume A", clientName: "Maison A" });
  const prod = await api<{ id: string }>(base, "POST", `/api/projects/${A.id}/products`, { name: "Aurora", spec: { category: "ring", subtype: "solitaire", metal: { type: "yellow_gold", karat: 18, finish: "high_polish" }, stones: [{ role: "center", type: "diamond", shape: "round_brilliant", carat: 1 }], setting: { type: "prong", prong_count: 4 }, dimensions: { band_width_mm: 2 } } });
  const campA = await api<{ id: string }>(base, "POST", `/api/projects/${A.id}/campaigns`, { name: "Hero stills", kind: "image", productIds: [prod.id], brief: { goal: "Launch", channels: ["ig_feed_45"], deliverables: { stills: 6 } }, settings: { variants_per_shot: 2 } });
  const plan = await api<{ job_id: string }>(base, "POST", `/api/campaigns/${campA.id}/plan`, { count: 6 });
  await waitJob(base, plan.job_id);
  let camp = await api<{ shots: { id: string; stats: { candidates: number }[] }[] }>(base, "GET", `/api/campaigns/${campA.id}`);
  expect(camp.shots.length).toBe(6);
  for (const sh of camp.shots) await api(base, "PATCH", `/api/shots/${sh.id}`, { approved: true });
  const gen = await api<{ child_job_ids: string[]; count: number }>(base, "POST", `/api/campaigns/${campA.id}/generate`, { stage: "stills" });
  expect(gen.count).toBe(6);
  // A review filter that must survive the restart.
  await api(base, "PUT", `/api/ui-state/${encodeURIComponent(`review:${campA.id}`)}`, { data: { review: ["unreviewed"], sort: "score" }, merge: true });

  // 2. Project B: a video campaign with a storyboard; reorder two frames and edit the brief in the UI.
  await new Promise((r) => setTimeout(r, 2000));
  const B = await api<{ id: string }>(base, "POST", "/api/projects", { name: "Resume B", clientName: "Maison B" });
  const prodB = await api<{ id: string }>(base, "POST", `/api/projects/${B.id}/products`, { name: "Luna hoops", spec: { category: "earring", subtype: "hoop", metal: { type: "white_gold", karat: 14, finish: "high_polish" }, stones: [], dimensions: { diameter_mm: 20 } } });
  const campB = await api<{ id: string }>(base, "POST", `/api/projects/${B.id}/campaigns`, { name: "Launch film", kind: "video", productIds: [prodB.id], brief: { goal: "Film", channels: ["ig_reels"], deliverables: { videos: [{ count: 1, duration_s: 10 }] } } });
  const sb = await api<{ job_id: string }>(base, "POST", `/api/campaigns/${campB.id}/storyboard`);
  await waitJob(base, sb.job_id);
  const before = await api<{ storyboard: { shots: { id: string; title: string }[] } }>(base, "GET", `/api/campaigns/${campB.id}`);
  const ids = before.storyboard.shots.map((x) => x.id);
  expect(ids.length).toBeGreaterThanOrEqual(3);

  const browser = await chromium.launch(browserLaunchOptions());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/projects/${B.id}/campaigns/${campB.id}/storyboard`);
  await expect(page.getByRole("heading", { name: "Frames" })).toBeVisible();
  const handles = page.getByRole("button", { name: "Drag" });
  await expect(handles.first()).toBeVisible();
  const h0 = await handles.nth(0).boundingBox();
  const h1 = await handles.nth(1).boundingBox();
  if (!h0 || !h1) throw new Error("drag handles not laid out");
  await page.mouse.move(h0.x + h0.width / 2, h0.y + h0.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(h0.x + ((h1.x + 40 - h0.x) * i) / 12, h0.y + h0.height / 2);
  await page.mouse.up();
  await expect.poll(async () => (await api<{ storyboard: { shots: { id: string }[] } }>(base, "GET", `/api/campaigns/${campB.id}`)).storyboard.shots.map((x) => x.id)[0], { timeout: 10_000 }).toBe(ids[1]);
  const reordered = (await api<{ storyboard: { shots: { id: string }[] } }>(base, "GET", `/api/campaigns/${campB.id}`)).storyboard.shots.map((x) => x.id);
  expect(reordered).not.toEqual(ids);

  await page.goto(`${base}/projects/${B.id}/campaigns/${campB.id}`);
  const goal = page.getByPlaceholder("What this campaign must achieve, in a sentence or two.");
  await goal.fill("Edited before the crash");
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => (await api<{ brief: { goal: string } }>(base, "GET", `/api/campaigns/${campB.id}`)).brief.goal, { timeout: 10_000 }).toBe("Edited before the crash");
  await browser.close();

  // 3. Kill both processes while project A is still generating, then relaunch (fast mock this time).
  const running = await api<{ items: { id: string }[] }>(base, "GET", "/api/jobs?status=queued,running&limit=100");
  expect(running.items.length).toBeGreaterThan(0);
  await s.stop();
  s = await startServers(dataDir, PORT, { MOCK_LATENCY_MS: "50" });

  // 4. Home resumes project B on the storyboard screen; everything edited is still there.
  const browser2 = await chromium.launch(browserLaunchOptions());
  const page2 = await browser2.newPage({ viewport: { width: 1440, height: 900 } });
  await page2.goto(`${base}/`);
  await expect(page2.getByText("Continue where you left off")).toBeVisible();
  await expect(page2.getByRole("heading", { name: "Resume B" })).toBeVisible();
  await page2.getByRole("button", { name: "Resume" }).click();
  await expect(page2).toHaveURL(new RegExp(`/projects/${B.id}/campaigns/${campB.id}$`));
  const after = await api<{ storyboard: { shots: { id: string }[] }; brief: { goal: string } }>(base, "GET", `/api/campaigns/${campB.id}`);
  expect(after.storyboard.shots.map((x) => x.id)).toEqual(reordered);
  expect(after.brief.goal).toBe("Edited before the crash");

  // Switch to project A: generations finish, every shot has candidates, nothing is billed twice.
  await page2.goto(`${base}/projects/${A.id}/campaigns/${campA.id}/review`);
  await expect.poll(async () => (await api<{ items: unknown[] }>(base, "GET", "/api/jobs?status=queued,running&limit=100")).items.length, { timeout: 180_000, intervals: [1000] }).toBe(0);
  camp = await api(base, "GET", `/api/campaigns/${campA.id}`);
  for (const sh of camp.shots) expect(sh.stats.reduce((n: number, x: { candidates: number }) => n + x.candidates, 0)).toBeGreaterThan(0);
  const done = await api<{ items: { id: string; type: string; status: string }[] }>(base, "GET", "/api/jobs?status=succeeded&limit=200");
  for (const id of gen.child_job_ids) expect(done.items.find((j) => j.id === id)?.status).toBe("succeeded");
  const ledger = await api<{ items: { jobId: string }[] }>(base, "GET", `/api/ledger?project_id=${A.id}&limit=200`);
  expect(ledger.items.length).toBe(6);
  expect(new Set(ledger.items.map((l) => l.jobId)).size).toBe(6);
  // Review filters restored from the server-side UI state.
  await page2.reload();
  await expect(page2.locator("button", { hasText: "Unreviewed" }).first()).toHaveAttribute("data-active", "true", { timeout: 15_000 });
  await browser2.close();
  await s.stop();
});
