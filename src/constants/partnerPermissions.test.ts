import { describe, expect, it } from "vitest";
import {
  canAccessConsolePath,
  consoleMenuFromPermissions,
  intersectPartnerPermissions,
  normalizeContractScope,
  partnerActingPermissions,
  partnerConsolePermissions,
  partnerHasConsolePermission,
  partnerOrgPermissions,
} from "@/constants/partnerPermissions";

describe("partner permission intersection", () => {
  it("maps handover scope aliases", () => {
    expect(normalizeContractScope(["bestand", "fristen", "pruefung"])).toEqual([
      "inventory",
      "due-dates",
      "inspection",
    ]);
  });

  it("never grants reserved slugs even if listed on the role", () => {
    const admin = partnerOrgPermissions("admin");
    expect(admin).not.toContain("users:view");
    expect(admin).not.toContain("roles:update");
    expect(admin).not.toContain("training:view");
    expect(admin).not.toContain("settings:oxid");
    expect(admin).not.toContain("catalog:update");
    expect(admin).toContain("inventory:update");
    expect(admin).toContain("audit:export");
  });

  it("intersects inspector with inventory-only scope", () => {
    const granted = partnerActingPermissions("inspector", ["inventory"]);
    expect(granted).toContain("inventory:view");
    expect(granted).toContain("catalog:view");
    expect(granted).toContain("audit:view");
    expect(granted).not.toContain("inventory:update");
    expect(granted).not.toContain("requests:transition");
    expect(granted).not.toContain("duties:view");
  });

  it("gives admin request + inventory when both scopes are present", () => {
    const granted = intersectPartnerPermissions("admin", ["inventory", "inspection"]);
    expect(granted).toContain("inventory:update");
    expect(granted).toContain("requests:transition");
    expect(granted).toContain("audit:export");
    expect(granted).not.toContain("duties:view");
    expect(granted).not.toContain("users:view");
  });

  it("returns nothing when the contract has no recognised scope", () => {
    expect(partnerActingPermissions("admin", [])).toEqual([]);
    expect(partnerActingPermissions("admin", ["unknown"])).toEqual([]);
  });

  it("does not let order edit inventory even with inventory scope", () => {
    const granted = partnerActingPermissions("order", ["inventory", "inspection"]);
    expect(granted).not.toContain("inventory:update");
    expect(granted).toContain("requests:create");
    expect(granted).toContain("parts:request");
  });
});

describe("partner console RBAC", () => {
  it("admin gets all console slugs including create and lifecycle", () => {
    const perms = partnerConsolePermissions("admin");
    expect(perms).toContain("console:nav");
    expect(perms).toContain("console:customers:create");
    expect(perms).toContain("console:contracts:lifecycle");
    expect(perms).toContain("console:staff:invite");
    expect(consoleMenuFromPermissions(perms).map((m) => m.id)).toEqual([
      "console-customers",
      "console-due-dates",
      "console-requests",
      "console-staff",
      "console-organisation",
      "console-activity",
      "console-settings",
    ]);
  });

  it("inspector can view but not create or invite", () => {
    const perms = partnerConsolePermissions("inspector");
    expect(partnerHasConsolePermission("inspector", "console:customers:view")).toBe(true);
    expect(partnerHasConsolePermission("inspector", "console:customers:create")).toBe(false);
    expect(partnerHasConsolePermission("inspector", "console:staff:invite")).toBe(false);
    expect(partnerHasConsolePermission("inspector", "console:contracts:lifecycle")).toBe(false);
    expect(consoleMenuFromPermissions(perms).some((m) => m.id === "console-staff")).toBe(false);
    expect(consoleMenuFromPermissions(perms).some((m) => m.id === "console-customers")).toBe(true);
  });

  it("order sees ops views but not staff or organisation", () => {
    const menuIds = consoleMenuFromPermissions(partnerConsolePermissions("order")).map((m) => m.id);
    expect(menuIds).toEqual(["console-customers", "console-due-dates", "console-requests"]);
  });

  it("guards console paths by slug", () => {
    const inspector = partnerConsolePermissions("inspector");
    expect(canAccessConsolePath("/partner/customers", inspector)).toBe(true);
    expect(canAccessConsolePath("/partner/customers/new", inspector)).toBe(false);
    expect(canAccessConsolePath("/partner/staff", inspector)).toBe(false);
    expect(canAccessConsolePath("/partner/customers/abc", inspector)).toBe(true);

    const admin = partnerConsolePermissions("admin");
    expect(canAccessConsolePath("/partner/customers/new", admin)).toBe(true);
    expect(canAccessConsolePath("/partner/staff", admin)).toBe(true);
  });
});
