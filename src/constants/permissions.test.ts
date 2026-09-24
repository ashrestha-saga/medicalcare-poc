import { describe, expect, it } from "vitest";
import {
  canAccessPath,
  hasPermission,
  menuForRole,
  permissionsForRole,
  ROLE_PERMISSIONS,
} from "@/constants/permissions";
import { resolveCapabilities } from "@/services/auth/capabilitiesService";

describe("RBAC defaults & path guards", () => {
  it("gives superadmin every slug including users/roles admin and shell:nav", () => {
    expect(hasPermission("superadmin", "settings:oxid")).toBe(true);
    expect(hasPermission("superadmin", "shell:nav")).toBe(true);
    expect(hasPermission("superadmin", "users:view")).toBe(true);
    expect(hasPermission("superadmin", "locations:view")).toBe(true);
    expect(hasPermission("superadmin", "roles:view")).toBe(true);
    expect(hasPermission("superadmin", "roles:update")).toBe(true);
    expect(hasPermission("superadmin", "duties:view")).toBe(true);
    expect(permissionsForRole("superadmin")).toEqual(ROLE_PERMISSIONS.superadmin);
    expect(menuForRole("superadmin").map((m) => m.id)).toEqual([
      "inventory",
      "registration",
      "due-dates",
      "training",
      "catalog",
      "clarifications",
      "requests",
      "users",
      "locations",
      "roles",
      "management",
      "security",
      "settings",
    ]);
  });

  it("lets device_admin work the queue but not admin or settings", () => {
    expect(hasPermission("device_admin", "shell:nav")).toBe(true);
    expect(hasPermission("device_admin", "requests:transition")).toBe(true);
    expect(hasPermission("device_admin", "inventory:update")).toBe(true);
    expect(hasPermission("device_admin", "catalog:view")).toBe(true);
    expect(hasPermission("device_admin", "catalog:update")).toBe(true);
    expect(hasPermission("device_admin", "clarifications:view")).toBe(true);
    expect(hasPermission("device_admin", "account:security")).toBe(true);
    expect(hasPermission("device_admin", "duties:view")).toBe(true);
    expect(hasPermission("device_admin", "training:view")).toBe(true);
    expect(hasPermission("device_admin", "management:view")).toBe(true);
    expect(hasPermission("device_admin", "users:view")).toBe(false);
    expect(hasPermission("device_admin", "locations:view")).toBe(false);
    expect(hasPermission("device_admin", "roles:view")).toBe(false);
    expect(hasPermission("device_admin", "settings:view")).toBe(false);
    expect(menuForRole("device_admin").map((m) => m.id)).toEqual([
      "inventory",
      "registration",
      "due-dates",
      "training",
      "catalog",
      "clarifications",
      "requests",
      "management",
      "security",
    ]);
  });

  it("gives security_officer department overview without settings or user admin", () => {
    expect(hasPermission("security_officer", "shell:nav")).toBe(true);
    expect(hasPermission("security_officer", "requests:view-all")).toBe(true);
    expect(hasPermission("security_officer", "duties:view")).toBe(true);
    expect(hasPermission("security_officer", "users:view")).toBe(false);
    expect(hasPermission("security_officer", "settings:oxid")).toBe(false);
  });

  it("limits user to inventory home without nav rail or /requests URL", () => {
    expect(hasPermission("user", "shell:nav")).toBe(false);
    expect(hasPermission("user", "users:view")).toBe(false);
    expect(hasPermission("user", "inventory:update")).toBe(false);
    expect(hasPermission("user", "requests:create")).toBe(true);
    expect(hasPermission("user", "account:security")).toBe(true);
    expect(menuForRole("user")).toEqual([]);

    const granted = permissionsForRole("user");
    expect(canAccessPath("/", granted)).toBe(true);
    expect(canAccessPath("/security", granted)).toBe(true);
    expect(canAccessPath("/requests", granted)).toBe(false);
    expect(canAccessPath("/users", granted)).toBe(false);
    expect(canAccessPath("/roles", granted)).toBe(false);
    expect(canAccessPath("/catalog", granted)).toBe(false);
    expect(canAccessPath("/due-dates", granted)).toBe(false);
  });

  it("requires shell:nav for non-home paths even when resource slug is present", () => {
    const withMineOnly = ["inventory:view", "requests:view-mine"] as const;
    expect(canAccessPath("/", withMineOnly)).toBe(true);
    expect(canAccessPath("/devices", withMineOnly)).toBe(false);
    expect(canAccessPath("/requests", withMineOnly)).toBe(false);

    const withNav = ["shell:nav", "inventory:view", "requests:view-mine"] as const;
    expect(canAccessPath("/devices", withNav)).toBe(true);
    expect(canAccessPath("/requests", withNav)).toBe(true);
    expect(canAccessPath("/due-dates", withNav)).toBe(false);

    const withDuties = ["shell:nav", "duties:view"] as const;
    expect(canAccessPath("/due-dates", withDuties)).toBe(true);

    const withManagement = ["shell:nav", "management:view"] as const;
    expect(canAccessPath("/management", withManagement)).toBe(true);
    expect(canAccessPath("/management", withNav)).toBe(false);
  });

  it("blocks /users, /locations, /roles, and /settings without admin slugs", () => {
    const staff = permissionsForRole("device_admin");
    expect(canAccessPath("/users", staff)).toBe(false);
    expect(canAccessPath("/locations", staff)).toBe(false);
    expect(canAccessPath("/roles", staff)).toBe(false);
    expect(canAccessPath("/settings", staff)).toBe(false);
    expect(canAccessPath("/management", staff)).toBe(true);

    const admin = permissionsForRole("superadmin");
    expect(canAccessPath("/users", admin)).toBe(true);
    expect(canAccessPath("/locations", admin)).toBe(true);
    expect(canAccessPath("/roles", admin)).toBe(true);
    expect(canAccessPath("/settings", admin)).toBe(true);
    expect(canAccessPath("/due-dates", staff)).toBe(true);
    expect(canAccessPath("/management", admin)).toBe(true);
  });

  it("resolveCapabilities mirrors seeded / default grants", async () => {
    const caps = await resolveCapabilities("security_officer");
    expect(caps.role).toBe("security_officer");
    expect(caps.permissions).toContain("requests:view-all");
    expect(caps.permissions).toContain("shell:nav");
    expect(caps.permissions).toContain("management:view");
    expect(caps.menu.some((m) => m.id === "settings")).toBe(false);
    expect(caps.menu.some((m) => m.id === "users")).toBe(false);
    expect(caps.menu.some((m) => m.id === "management")).toBe(true);

    const adminCaps = await resolveCapabilities("superadmin");
    expect(adminCaps.menu.map((m) => m.id)).toContain("users");
    expect(adminCaps.menu.map((m) => m.id)).toContain("roles");
    expect(adminCaps.menu.map((m) => m.id)).toContain("due-dates");
    expect(adminCaps.menu.map((m) => m.id)).toContain("management");
    expect(adminCaps.permissions).toContain("roles:update");
    expect(adminCaps.permissions).toContain("duties:view");
    expect(adminCaps.permissions).toContain("management:view");

    const userCaps = await resolveCapabilities("user");
    expect(userCaps.menu).toEqual([]);
    expect(userCaps.permissions).not.toContain("shell:nav");
    expect(userCaps.permissions).not.toContain("management:view");
  });
});
