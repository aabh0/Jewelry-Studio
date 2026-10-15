import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface Servers { stop: () => Promise<void>; base: string }

/** Chromium to launch: PLAYWRIGHT_CHROMIUM_PATH, else a preinstalled /opt/pw-browsers/chromium, else Playwright's own download. */
export function browserLaunchOptions(): { executablePath?: string } {
  const p = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
  return fs.existsSync(p) ? { executablePath: p } : {};
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

function waitFor(url: string, ms: number): Promise<void> {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try { const r = await fetch(url); if (r.ok) return resolve(); } catch { /* not up yet */ }
      if (Date.now() - t0 > ms) return reject(new Error(`timeout waiting for ${url}`));
      setTimeout(tick, 400);
    };
    void tick();
  });
}

/** Starts the Next server (standalone build when present, otherwise `next dev`) and the worker against DATA_DIR. */
export async function startServers(dataDir: string, port: number, extraEnv: Record<string, string> = {}): Promise<Servers> {
  fs.mkdirSync(dataDir, { recursive: true });
  const env: NodeJS.ProcessEnv = { ...process.env, MOCK_PROVIDERS: "1", DATA_DIR: dataDir, PORT: String(port), HOSTNAME: "127.0.0.1", HOST: "127.0.0.1", NODE_ENV: "production", ...extraEnv } as NodeJS.ProcessEnv;
  const standalone = path.join(ROOT, ".next", "standalone", "server.js");
  const procs: ChildProcess[] = [];
  const log = (name: string, p: ChildProcess) => { if (process.env.E2E_VERBOSE) { p.stdout?.on("data", (d) => process.stdout.write(`[${name}] ${d}`)); p.stderr?.on("data", (d) => process.stderr.write(`[${name}] ${d}`)); } };
  const web = fs.existsSync(standalone)
    ? spawn(process.execPath, [standalone], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] })
    : spawn("pnpm", ["exec", "next", "dev", "-p", String(port)], { cwd: ROOT, env: { ...env, NODE_ENV: "development" } as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
  log("web", web);
  procs.push(web);
  const worker = spawn("pnpm", ["exec", "tsx", "worker/main.ts"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  log("worker", worker);
  procs.push(worker);
  const base = `http://127.0.0.1:${port}`;
  await waitFor(`${base}/api/health`, 180_000);
  return {
    base,
    stop: async () => {
      for (const p of procs) { try { p.kill("SIGKILL"); } catch { /* gone */ } }
      await new Promise((r) => setTimeout(r, 800));
    },
  };
}

export async function api<T = unknown>(base: string, method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(base + url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status}: ${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export async function waitJob(base: string, id: string, ms = 120_000): Promise<string> {
  const t0 = Date.now();
  for (;;) {
    const j = await api<{ status: string; error: string | null }>(base, "GET", `/api/jobs/${id}`);
    if (j.status === "succeeded") return j.status;
    if (j.status === "failed" || j.status === "cancelled") throw new Error(`job ${id} ${j.status}: ${j.error}`);
    if (Date.now() - t0 > ms) throw new Error(`job ${id} still ${j.status} after ${ms}ms`);
    await new Promise((r) => setTimeout(r, 500));
  }
}
