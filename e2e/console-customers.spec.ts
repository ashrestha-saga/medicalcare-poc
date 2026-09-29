import { expect, test } from "@playwright/test";
import type { SessionUser } from "../src/interfaces/session";
import { injectSession } from "./auth";

const MSR_ID = "1f0f2544-0dc8-5869-9c13-85f741e48258";

const PARTNER_ADMIN: SessionUser = {
  id: "user-partner-msr-adler",
  name: "K. Adler",
  accountKind: "partner",
  organisationId: MSR_ID,
  organisationName: "Medtech Service Rhein GmbH",
  appRole: "admin",
};

const PARTNER_INSPECTOR: SessionUser = {
  id: "user-partner-msr-reinhardt",
  name: "J. Reinhardt",
  accountKind: "partner",
  organisationId: MSR_ID,
  organisationName: "Medtech Service Rhein GmbH",
  appRole: "inspector",
};

test("partner admin lands on customers and can open create", async ({ page, context }) => {
  await injectSession(context, PARTNER_ADMIN);
  await page.goto("/partner");
  await expect(page.getByTestId("console-shell")).toBeVisible();
  await expect(page.getByTestId("console-customers-page")).toBeVisible();
  await expect(page.getByTestId("console-customers-table")).toBeVisible();
  await page.getByTestId("console-create-clinic").click();
  await expect(page.getByTestId("console-create-clinic-page")).toBeVisible();
  await expect(page.getByTestId("clinic-name")).toBeVisible();
});

test("partner inspector can list customers but cannot create", async ({ page, context }) => {
  await injectSession(context, PARTNER_INSPECTOR);
  await page.goto("/partner/customers");
  await expect(page.getByTestId("console-customers-page")).toBeVisible();
  await expect(page.getByTestId("console-create-clinic")).toHaveCount(0);
  await page.goto("/partner/customers/new");
  await expect(page.getByTestId("console-create-denied")).toBeVisible();
});
