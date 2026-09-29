import { expect, test } from "@playwright/test";
import type { SessionUser } from "../src/interfaces/session";
import { injectSession } from "./auth";

const ADMIN: SessionUser = {
  id: "user-admin-1",
  name: "Admin Klinik",
  accountKind: "clinic",
  role: "superadmin",
  tenantId: "demo-tenant",
};

const NURSE: SessionUser = {
  id: "user-nurse-1",
  name: "Ben Pflege",
  accountKind: "clinic",
  role: "user",
  tenantId: "demo-tenant",
};

test("superadmin can open Activity", async ({ page, context }) => {
  await injectSession(context, ADMIN);
  await page.goto("/activity");
  await page.getByTestId("pin-skip").click();
  await expect(page.getByTestId("activity-page")).toBeVisible();
  await expect(page.getByTestId("data-table")).toBeVisible();
  await expect(page.getByTestId("nav-activity")).toBeVisible();
});

test("floor user cannot open Activity", async ({ page, context }) => {
  await injectSession(context, NURSE);
  await page.goto("/activity");
  await page.getByTestId("pin-skip").click();
  await expect(page.getByTestId("forbidden")).toBeVisible();
});
