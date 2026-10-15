import { defineConfig } from "@playwright/test";

// The specs under tests/e2e start their own app + worker processes (see tests/e2e/harness.ts)
// so they can kill and relaunch them mid-run. Set E2E_BASE_URL to point tests at a server you run yourself.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 600_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3124", viewport: { width: 1440, height: 900 } },
});
