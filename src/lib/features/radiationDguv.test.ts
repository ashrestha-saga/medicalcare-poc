import { describe, expect, it } from "vitest";
import {
  isRadiationDguvEnabled,
  parseRadiationDguvFlags,
  requireRadiationDguvEnabled,
} from "./radiationDguv";
import { parseFeatureFlags } from "./repairs";

describe("radiation_dguv feature flag", () => {
  it("defaults to off", () => {
    expect(isRadiationDguvEnabled(null)).toBe(false);
    expect(isRadiationDguvEnabled({})).toBe(false);
    expect(parseRadiationDguvFlags({ radiation_dguv: "yes" }).radiation_dguv).toBe(false);
  });

  it("enables only for strict true", () => {
    expect(isRadiationDguvEnabled({ radiation_dguv: true })).toBe(true);
  });

  it("keeps repairs parse working alongside radiation_dguv", () => {
    const flags = parseFeatureFlags({ repairs: true, radiation_dguv: true });
    expect(flags.repairs).toBe(true);
    expect(flags.radiation_dguv).toBe(true);
  });

  it("require throws when off", () => {
    expect(() => requireRadiationDguvEnabled({})).toThrow(/not enabled/i);
  });
});
