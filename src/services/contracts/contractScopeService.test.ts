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

  it("dual-read: unions JSON tokens with positive grant rows", () => {
    const slugs = resolveContractScopeSlugs(JSON.stringify(["inventory"]), [
      { permission: "requests:create", denied: false },
    ]);
    expect(slugs).toContain("inventory:view");
    expect(slugs).toContain("requests:create");
  });

  it("subtracts denied (nie) rows from the token∪grant union", () => {
    const slugs = resolveContractScopeSlugs(JSON.stringify(["inventory"]), [
      { permission: "inventory:view", denied: false },
      { permission: "inventory:update", denied: true },
    ]);
    expect(slugs).toContain("inventory:view");
    expect(slugs).not.toContain("inventory:update");
  });

  it("expands training and reprocessing tokens to acting menu slugs", () => {
    const slugs = expandScopeTokensToSlugs(["training", "reprocessing"]);
    expect(slugs).toContain("training:view");
    expect(slugs).toContain("reprocessing:view");
    expect(slugs).not.toContain("reprocessing:release");
  });
});

