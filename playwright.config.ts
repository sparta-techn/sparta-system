import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — the top of the test pyramid (real browser, real app).
 *
 * E2E specs live in `tests/e2e/*.spec.ts` (`.spec.ts`, so Vitest — which only
 * collects `*.test.ts[x]` — never picks them up). Playwright starts the app for
 * you via `webServer`; point `PLAYWRIGHT_BASE_URL` at an already-running server
 * to skip that.
 *
 * First run: `npx playwright install` to download browsers, then
 * `npm run test:e2e` (or `npm run test:e2e:ui`). See `docs/TESTING.md`.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  // Fail the CI build if a `test.only` is committed by accident.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    // Capture a trace on the first retry — cheap locally, invaluable in CI.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Enable more browsers as coverage grows:
    // { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    // { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
