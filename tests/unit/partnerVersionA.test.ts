import { describe, expect, it } from "vitest";
import {
  partnerConsolePermissions,
  partnerHasConsolePermission,
  partnerOrgPermissions,
  consoleMenuFromPermissions,
} from "@/constants/partnerPermissions";
import {
  CONSOLE_NAV_PRESETS,
  todayTilesForRole,
} from "@/constants/partnerConsoleNav";

describe("Version A partner management role", () => {
  it("grants Heute / customers / orders read and contract/member manage", () => {
    const consolePerms = partnerConsolePermissions("management");
    expect(consolePerms).toContain("console:today:view");
    expect(consolePerms).toContain("console:customers:view");
    expect(consolePerms).toContain("console:disposition:view");
    expect(consolePerms).toContain("contracts:manage");
    expect(consolePerms).toContain("members:manage");
    expect(consolePerms).toContain("smtp:manage");
  });

  it("denies dispatch and inspection write on console", () => {
    expect(partnerHasConsolePermission("management", "console:disposition:assign")).toBe(false);
    expect(partnerHasConsolePermission("management", "visits:manage")).toBe(false);
    expect(partnerHasConsolePermission("management", "inspection:sign")).toBe(false);
    const acting = partnerOrgPermissions("management");
    expect(acting).not.toContain("requests:create");
    expect(acting).not.toContain("inspections:perform");
    expect(acting).not.toContain("requests:transition");
  });

  it("does not silently map unknown roles to inspector", () => {
    expect(partnerConsolePermissions("mystery")).toEqual([]);
    expect(partnerOrgPermissions("mystery")).toEqual([]);
  });

  it("exposes a single Aufträge nav item — not portfolio/dispatch", () => {
    const ids = consoleMenuFromPermissions(partnerConsolePermissions("admin")).map((m) => m.id);
    expect(ids).toContain("console-orders");
    expect(ids).not.toContain("console-disposition");
    expect(ids).not.toContain("console-assignments");
  });

  it("nav bands match v14-A role presets", () => {
    expect(CONSOLE_NAV_PRESETS.management.taeglich).toEqual(["heute", "kunden", "disposition"]);
    expect(CONSOLE_NAV_PRESETS.service_lead.taeglich).toEqual([
      "heute",
      "disposition",
      "faellig",
      "kunden",
    ]);
    expect(CONSOLE_NAV_PRESETS.admin.taeglich).toEqual([
      "heute",
      "disposition",
      "faellig",
      "kunden",
    ]);
    expect(CONSOLE_NAV_PRESETS.inspector.taeglich).toEqual(["heute", "meine", "disposition"]);
    expect(CONSOLE_NAV_PRESETS.inspector.selten).toEqual([]);
  });

  it("Heute zone-1 catalog is role-filtered and ≤3 after sort is caller’s job", () => {
    expect(todayTilesForRole("management").filter((t) => t.zone === "ent").length).toBeGreaterThan(
      0,
    );
    expect(todayTilesForRole("inspector").every((t) => t.roles.includes("inspector"))).toBe(true);
    expect(todayTilesForRole("service_lead").some((t) => t.id === "ohneRueckfluss")).toBe(true);
    expect(todayTilesForRole("management").some((t) => t.id === "ohneRueckfluss")).toBe(false);
    expect(todayTilesForRole("admin").length).toBeGreaterThan(
      todayTilesForRole("service_lead").length,
    );
  });
});
