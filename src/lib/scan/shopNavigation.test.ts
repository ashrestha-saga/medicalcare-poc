import { describe, expect, it } from "vitest";
import { safeAppPath, scanResumePath, shopPathForDevice } from "./shopNavigation";

describe("safeAppPath", () => {
  it("allows relative app paths", () => {
    expect(safeAppPath("/?device=abc")).toBe("/?device=abc");
    expect(safeAppPath("/devices?id=1")).toBe("/devices?id=1");
  });

  it("rejects open redirects", () => {
    expect(safeAppPath("https://evil.example")).toBeNull();
    expect(safeAppPath("//evil.example")).toBeNull();
    expect(safeAppPath("javascript:alert(1)")).toBeNull();
    expect(safeAppPath(null)).toBeNull();
  });
});

describe("shopPathForDevice", () => {
  it("builds shop URL with sanitized returnTo and accessories tab", () => {
    const href = shopPathForDevice("dev-1", scanResumePath("dev-1"), { tab: "accessories" });
    expect(href).toContain("/shop?");
    expect(href).toContain("device=dev-1");
    expect(href).toContain("returnTo=");
    expect(href).toContain("tab=accessories");
    expect(shopPathForDevice("dev-1", "https://evil")).not.toContain("returnTo");
  });
});
