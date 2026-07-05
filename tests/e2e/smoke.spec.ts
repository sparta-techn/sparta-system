/**
 * E2E smoke test — the app boots and guards protected routes.
 *
 * Runs against the real app in a real browser (see `playwright.config.ts`). No
 * mocks: this is the ultimate "does it actually work end-to-end" check. Keep
 * E2E specs few and high-value — they're the slowest, most brittle layer.
 */
import { expect, test } from "@playwright/test";

test.describe("app smoke", () => {
  test("serves the sign-in page", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page).toHaveTitle(/sign in/i);
  });

  test("redirects an unauthenticated user away from a protected route", async ({ page }) => {
    await page.goto("/app");
    // The `_authenticated` guard redirects to /auth (with a redirect param).
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });
});
