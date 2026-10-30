import { describe, expect, it } from "vitest";
import { dispositionDisplayState, nextDispositionDisplayState } from "./dispositionService";

describe("dispositionDisplayState", () => {
  it("keeps sent and in-app handoff distinct from captured", () => {
    expect(dispositionDisplayState("captured", null, null)).toBe("erfasst");
    expect(dispositionDisplayState("queued", null, null)).toBe("warteschlange");
    expect(dispositionDisplayState("transmitted", null, null)).toBe("uebermittelt");
    expect(dispositionDisplayState("handed_off", null, null)).toBe("uebergeben");
  });

  it("advances sent and handed-off work to assigned", () => {
    expect(nextDispositionDisplayState("uebermittelt")).toBe("zugewiesen");
    expect(nextDispositionDisplayState("uebergeben")).toBe("zugewiesen");
    expect(nextDispositionDisplayState("erfasst")).toBe("zugewiesen");
  });
});
