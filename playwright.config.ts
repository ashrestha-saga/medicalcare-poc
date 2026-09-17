import { defineConfig, devices } from "@playwright/test";

// Point at an already-running server with PLAYWRIGHT_BASE_URL; otherwise the dev server is started.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  // Specs share one seeded SQLite database and one in-memory rate limiter; run them serially.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npx next dev -p ${port} -H 127.0.0.1`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    // Chromium-based tablet profile so a single `playwright install chromium` covers both projects.
    { name: "tablet", use: { ...devices["Galaxy Tab S4"] } },
  ],
});
