import { describe, expect, it } from "vitest";
import { confidenceLabel, deadlineAnchorLabel, serviceTypeForDuty } from "./dutyDisplay";

describe("serviceTypeForDuty", () => {
  it("keeps STK and MTK", () => {
    expect(serviceTypeForDuty("STK")).toBe("STK");
    expect(serviceTypeForDuty("mtk")).toBe("MTK");
  });

  it("maps radiation and software families", () => {
    expect(serviceTypeForDuty("CONSTANCY")).toBe("RADIATION");
    expect(serviceTypeForDuty("EXPERT")).toBe("RADIATION");
    expect(serviceTypeForDuty("ITSEC")).toBe("SOFTWARE");
  });

  it("falls back to OTHER for maintenance", () => {
    expect(serviceTypeForDuty("MAINT")).toBe("OTHER");
  });
});

describe("due-date display labels", () => {
  it("uses mockup chrome for anchors and confidence", () => {
    expect(deadlineAnchorLabel("exact_day")).toBe("to the day");
    expect(deadlineAnchorLabel("year_end")).toBe("year-end");
    expect(deadlineAnchorLabel("interval")).toBe("recurring");
    expect(confidenceLabel("verified")).toBe("evidenced");
    expect(confidenceLabel("derived")).toBe("derived");
  });
});
