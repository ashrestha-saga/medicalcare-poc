import type { BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { SessionUser } from "../src/interfaces/session";
import { SESSION_COOKIE, buildSessionToken } from "../src/lib/auth/sessionToken";

const E2E_USER: SessionUser = {
  id: "user-tech-1",
  name: "Anna Technik",
  role: "device_admin",
  tenantId: "demo-tenant",
};

/** Inject a signed session cookie (no UI login). */
export async function injectSession(context: BrowserContext, user: SessionUser = E2E_USER) {
  const secret = process.env.SESSION_SECRET || "insecure-dev-session-secret";
  const value = buildSessionToken(user, secret);
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value,
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export async function signInAndSkipPin(page: Page, user: SessionUser = E2E_USER) {
  await injectSession(page.context(), user);
  await page.goto("/");
  await page.getByTestId("pin-skip").click();
  await expect(page.getByTestId("scan-screen")).toBeVisible();
}
