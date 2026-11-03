import { describe, expect, it } from "vitest";
import {
  INSPECT_NAV_PRESETS,
  inspectNavKeyFromPath,
  isInspectProtocolPath,
} from "./inspectNav";

describe("inspectNav Phase 2", () => {
  it("maps technician and external presets", () => {
    expect(INSPECT_NAV_PRESETS.techniker.taeglich).toEqual(["heute", "woche", "queue"]);
    expect(INSPECT_NAV_PRESETS.fremd.taeglich).toEqual(["heute", "woche"]);
  });

  it("detects protocol vs nav paths", () => {
    expect(isInspectProtocolPath("/inspect/heute")).toBe(false);
    expect(isInspectProtocolPath("/inspect/REF-1")).toBe(true);
    expect(inspectNavKeyFromPath("/inspect")).toBe("heute");
    expect(inspectNavKeyFromPath("/inspect/zugang")).toBe("zugang");
    expect(inspectNavKeyFromPath("/inspect/ABC")).toBe(null);
  });
});
