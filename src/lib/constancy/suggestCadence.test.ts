import { describe, expect, it } from "vitest";
import { suggestFromDefaultCadence } from "./suggestCadence";

describe("suggestFromDefaultCadence", () => {
  it("maps arbeitstäglich to 1 working_days", () => {
    expect(suggestFromDefaultCadence("arbeitstäglich")).toEqual({
      intervalValue: 1,
      intervalUnit: "working_days",
      hint: expect.stringContaining("arbeitstäglich"),
    });
  });

  it("maps monthly / yearly defaults", () => {
    expect(suggestFromDefaultCadence("monatlich").intervalUnit).toBe("months");
    expect(suggestFromDefaultCadence("jährlich").intervalUnit).toBe("years");
  });
});
