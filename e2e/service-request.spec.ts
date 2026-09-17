import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { injectSession, signInAndSkipPin } from "./auth";
import { SESSION_COOKIE, buildSessionToken } from "../src/lib/auth/sessionToken";
import type { SessionUser } from "../src/interfaces/session";

const REFERENCE = /^SR-\d{8}-[A-Z0-9]{6}$/;
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const TECH: SessionUser = {
  id: "user-tech-1",
  name: "Anna Technik",
  role: "device_admin",
  tenantId: "demo-tenant",
};

const NURSE: SessionUser = {
  id: "user-nurse-1",
  name: "Ben Pflege",
  role: "user",
  tenantId: "demo-tenant",
};

async function resolveManually(page: Page, identifier: string) {
  await page.getByTestId("manual-entry-open").click();
  await page.getByTestId("manual-entry-input").fill(identifier);
  await page.getByTestId("manual-entry-submit").click();
}

async function enterPin(page: Page, pin: string) {
  await expect(page.getByLabel("0 of 4 digits entered")).toBeVisible();
  for (const d of pin) await page.getByTestId(`pin-${d}`).click();
}

function sessionCookieHeader(user: SessionUser = TECH) {
  const secret = process.env.SESSION_SECRET || "insecure-dev-session-secret";
  return `${SESSION_COOKIE}=${buildSessionToken(user, secret)}`;
}

async function authedPost(request: APIRequestContext, path: string, data: unknown) {
  return request.post(path, {
    data,
    headers: { Cookie: sessionCookieHeader() },
  });
}

test.describe("AC-E2E-01 — scan → device → service request → reference", () => {
  test("known inventory device with a verified classification proposal", async ({ page }) => {
    await signInAndSkipPin(page, TECH);
    await resolveManually(page, "INV-10001");

    await expect(page.getByTestId("device-screen")).toBeVisible();
    await expect(page.getByTestId("source-banner")).toHaveAttribute("data-source", "device-inventory");
    await expect(page.getByTestId("device-title")).toContainText("Infusion Pump X200");

    await page.getByTestId("continue-service-request").click();
    await expect(page.getByTestId("service-request-form")).toBeVisible();

    await expect(page.getByTestId("confidence-chip")).toHaveText("verified");
    await expect(page.getByTestId("suggested-STK")).toBeVisible();
    await expect(page.getByTestId("inspection-list")).toBeVisible();

    await expect(page.getByTestId("site-select")).toHaveValue("site-bonn");
    await expect(page.getByTestId("room-input")).toHaveValue("Room 4");
    await expect(page.getByTestId("delivery-input")).not.toHaveValue("");

    await page.getByTestId("submit-service-request").click();
    await expect(page.getByTestId("classification-error")).toBeVisible();

    await page.getByTestId("confirm-classification").click();
    await page.getByTestId("note-input").fill("Display flickers intermittently.");
    await page.getByTestId("submit-service-request").click();

    await expect(page.getByTestId("success-state")).toBeVisible();
    await expect(page.getByTestId("success-reference")).toHaveText(REFERENCE);
    await expect(page.getByTestId("status-timeline")).toContainText("transmitted");

    await page.getByTestId("scan-next").click();
    await expect(page.getByTestId("scan-screen")).toBeVisible();
  });

  test("catalog device with a derived proposal is not pre-selected (FA-206)", async ({ page }) => {
    await signInAndSkipPin(page, NURSE);
    await resolveManually(page, "(01)04012345678918(21)SN-777");

    await expect(page.getByTestId("catalog-model-view")).toBeVisible();
    await expect(page.getByTestId("source-banner")).toHaveAttribute("data-source", "catalog");
    await expect(page.getByTestId("catalog-lead")).toContainText("kein Gerät hinterlegt");
    await page.getByTestId("adopt-catalog").click();

    await expect(page.getByTestId("catalog-action-view")).toBeVisible();
    await expect(page.getByTestId("open-parts")).toBeEnabled();
    await page.getByTestId("continue-service-request").click();

    await expect(page.getByTestId("confidence-chip")).toHaveText("derived");
    await page.getByTestId("site-select").selectOption("site-cologne");
    await page.getByTestId("room-input").fill("OR 2");
    await page.getByTestId("submit-service-request").click();
    await expect(page.getByText("Please choose a service or inspection type.")).toBeVisible();

    await page.getByTestId("inspection-STK").click();
    await page.getByTestId("submit-service-request").click();
    await expect(page.getByTestId("success-reference")).toHaveText(REFERENCE);
  });

  test("unknown identifier falls through to manual capture, which is service-only", async ({ page }) => {
    await signInAndSkipPin(page, TECH);
    await resolveManually(page, "04012345678956");

    await expect(page.getByTestId("manual-capture")).toBeVisible();
    await page.getByTestId("capture-name").fill("Old defibrillator");
    await page.getByTestId("photo-input-nameplate").setInputFiles({ name: "nameplate.png", mimeType: "image/png", buffer: ONE_PIXEL_PNG });
    await page.getByTestId("capture-save").click();

    await expect(page.getByTestId("device-screen")).toBeVisible();
    await expect(page.getByTestId("source-banner")).toHaveAttribute("data-source", "manual");
    await expect(page.getByTestId("open-parts")).toBeDisabled();

    await page.getByTestId("continue-service-request").click();
    await page.getByTestId("inspection-REPAIR").click();
    await page.getByTestId("site-select").selectOption("site-bonn");
    await page.getByTestId("room-input").fill("Storage 1");
    await page.getByTestId("submit-service-request").click();
    await expect(page.getByTestId("success-reference")).toHaveText(REFERENCE);
  });
});

test.describe("Security", () => {
  test("API refuses unauthenticated calls and never trusts a tenant from the body", async ({ request }) => {
    const anon = await request.post("/api/resolve", { data: { raw: "INV-10001", context: "service" } });
    expect(anon.status()).toBe(401);
    expect(await anon.json()).not.toHaveProperty("error.stack");

    const spoofed = await authedPost(request, "/api/resolve", {
      raw: "INV-10001",
      context: "service",
      tenantId: "someone-else",
    });
    expect(spoofed.status()).toBe(200);
    expect((await spoofed.json()).device.id).toBe("instance-inv-10001");
  });

  test("PIN lock: unlock with the right PIN, sign out after three wrong attempts (SEC-901)", async ({ page }) => {
    await injectSession(page.context(), TECH);
    await page.goto("/");
    await expect(page.getByTestId("pin-setup")).toBeVisible();
    await enterPin(page, "1234");
    await enterPin(page, "1234");
    await expect(page.getByTestId("scan-screen")).toBeVisible();

    await page.getByTestId("lock-button").click();
    await expect(page.getByTestId("lock-screen")).toBeVisible();
    await enterPin(page, "1234");
    await expect(page.getByTestId("scan-screen")).toBeVisible();

    await page.getByTestId("lock-button").click();
    for (let i = 0; i < 3; i++) {
      await enterPin(page, "0000");
      if (i < 2) await expect(page.getByTestId("pin-error")).toBeVisible();
    }
    await expect(page.getByTestId("oxid-login")).toBeVisible();
    await expect(page.getByText(/Too many wrong PIN attempts/)).toBeVisible();
  });
});
