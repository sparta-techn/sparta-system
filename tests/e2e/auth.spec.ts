/**
 * E2E flow test — the sign-in form.
 *
 * Demonstrates driving a form with realistic user actions and asserting on
 * validation feedback. It intentionally does NOT depend on real Supabase
 * credentials: it verifies client-side behavior (validation, the invalid-
 * credentials path). A fully authenticated journey belongs behind a seeded
 * test user + `storageState` — see `docs/TESTING.md` §"Authenticated E2E".
 */
import { expect, test } from "@playwright/test";

test.describe("sign-in form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
  });

  test("validates an empty submission", async ({ page }) => {
    await page.getByRole("button", { name: /sign in/i }).click();
    // Zod-backed form: an inline validation message appears, no navigation.
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByText(/email/i).first()).toBeVisible();
  });

  test("rejects invalid credentials without leaking which factor failed", async ({ page }) => {
    await page.getByLabel(/email/i).fill("nobody@example.com");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password-123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Generic message (no account enumeration) — see features/auth/errors.ts.
    await expect(page.getByText(/incorrect email or password|something went wrong/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth/);
  });
});
