import { describe, expect, it } from "vitest";
import { isAppLocale, readLocaleCookie, intlLocale } from "./locale";

describe("locale helpers", () => {
  it("accepts only en and de", () => {
    expect(isAppLocale("en")).toBe(true);
    expect(isAppLocale("de")).toBe(true);
    expect(isAppLocale("fr")).toBe(false);
    expect(isAppLocale(null)).toBe(false);
  });

  it("falls back to en for bad cookie values", () => {
    expect(readLocaleCookie("de")).toBe("de");
    expect(readLocaleCookie("nope")).toBe("en");
    expect(readLocaleCookie(undefined)).toBe("en");
  });

  it("maps to Intl tags", () => {
    expect(intlLocale("en")).toBe("en-GB");
    expect(intlLocale("de")).toBe("de-DE");
  });
});
