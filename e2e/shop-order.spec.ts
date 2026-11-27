import { test, expect } from "@playwright/test";
import { signInAs } from "./auth";
import type { SessionUser } from "../src/interfaces/session";

const TECH: SessionUser = {
  id: "user-tech-1",
  name: "Anna Technik",
  accountKind: "clinic",
  role: "device_admin",
  tenantId: "demo-tenant",
};

test.describe("Shop order smoke (mock provider)", () => {
  test("settings shows shop panel; device parts opens shop articles", async ({ page }) => {
    await signInAs(page, TECH);

    await page.goto("/settings");
    await expect(page.getByTestId("shop-settings-panel")).toBeVisible();
    await expect(page.getByTestId("oxid-connection-status")).toBeVisible();

    await page.goto("/");
    await page.getByTestId("manual-entry-open").click();
    await page.getByTestId("manual-entry-input").fill("INV-10001");
    await page.getByTestId("manual-entry-submit").click();
    await expect(page.getByTestId("device-screen")).toBeVisible();

    await page.getByTestId("open-parts").click();
    await expect(page.getByTestId("parts-screen")).toBeVisible();
  });
});
