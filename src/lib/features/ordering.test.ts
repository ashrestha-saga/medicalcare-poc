import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { isOrderingEnabled, requireOrderingEnabled } from "./ordering";

describe("ordering feature flag", () => {
  it("is off by default", () => {
    expect(isOrderingEnabled(null)).toBe(false);
    expect(isOrderingEnabled({})).toBe(false);
    expect(isOrderingEnabled({ ordering: false })).toBe(false);
  });

  it("is on when ordering true", () => {
    expect(isOrderingEnabled({ ordering: true })).toBe(true);
  });

  it("requireOrderingEnabled throws 403 when off", () => {
    expect(() => requireOrderingEnabled({})).toThrow(AppError);
    try {
      requireOrderingEnabled({});
    } catch (e) {
      expect(e).toMatchObject({ status: 403 });
    }
  });
});
