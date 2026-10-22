import { describe, expect, it } from "vitest";
import {
  expandScopeTokensToSlugs,
  resolveContractScopeSlugs,
} from "./contractScopeService";

describe("contractScopeService", () => {
  it("expands inventory token without forbidden slugs", () => {
    const slugs = expandScopeTokensToSlugs(["inventory"]);
    expect(slugs).toContain("inventory:view");
    expect(slugs).not.toContain("incidents:manage");
    expect(slugs).not.toContain("users:view");
  });

  it("dual-read: empty grants fall back to JSON tokens", () => {
    const slugs = resolveContractScopeSlugs(JSON.stringify(["inspection"]), []);
    expect(slugs).toContain("fieldsafety:view");
    expect(slugs).toContain("fieldsafety:create");
  });

  it("dual-read: grant rows win over JSON", () => {
    const slugs = resolveContractScopeSlugs(JSON.stringify(["inventory", "inspection"]), [
      { permission: "inventory:view", denied: false },
    ]);
    expect(slugs).toEqual(["inventory:view"]);
  });

  it("subtracts denied (nie) rows from positive grants", () => {
    const slugs = resolveContractScopeSlugs(JSON.stringify(["inspection"]), [
      { permission: "inventory:view", denied: false },
      { permission: "inventory:update", denied: false },
      { permission: "inventory:update", denied: true },
    ]);
    expect(slugs).toEqual(["inventory:view"]);
  });
});

