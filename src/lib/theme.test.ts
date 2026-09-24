import { describe, expect, it } from "vitest";
import { isThemePreference, resolveTheme } from "./theme";

describe("theme helpers", () => {
  it("accepts only light, dark, system", () => {
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("auto")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it("resolves explicit preferences without reading the OS", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });
});
