import { describe, expect, it } from "vitest";
import { guidelineCadenceMismatch, suggestFromDefaultCadence } from "./suggestCadence";

describe("suggestFromDefaultCadence", () => {
  it("maps arbeitstäglich to 1 working_days", () => {
    expect(suggestFromDefaultCadence("arbeitstäglich")).toMatchObject({
      intervalValue: 1,
      intervalUnit: "working_days",
      parsed: true,
    });
  });

  it("maps monthly / yearly defaults", () => {
    expect(suggestFromDefaultCadence("monatlich").intervalUnit).toBe("months");
    expect(suggestFromDefaultCadence("jährlich").intervalUnit).toBe("years");
  });
});

describe("guidelineCadenceMismatch", () => {
  it("blocks working days against a monthly guideline", () => {
    expect(guidelineCadenceMismatch("monatlich", "working_days").mismatch).toBe(true);
    expect(guidelineCadenceMismatch("monatlich", "months").mismatch).toBe(false);
  });

  it("allows arbeitstäglich with working days", () => {
    expect(guidelineCadenceMismatch("arbeitstäglich", "working_days").mismatch).toBe(false);
  });
});
