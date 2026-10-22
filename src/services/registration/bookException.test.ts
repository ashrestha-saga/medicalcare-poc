import { describe, expect, it } from "vitest";
import { isMpbetreibV34BookException } from "@/services/registration/bookException";
import { evaluatesAppliesWhen } from "@/services/registration/prerequisites";

describe("isMpbetreibV34BookException", () => {
  it("flags compact thermometer and mercury/aneroid manometers", () => {
    expect(isMpbetreibV34BookException({ produktart: "messgeraet", kompaktThermometer: true })).toBe(
      true,
    );
    expect(
      isMpbetreibV34BookException({ produktart: "messgeraet", manometerTyp: "aneroid" }),
    ).toBe(true);
    expect(
      isMpbetreibV34BookException({ produktart: "messgeraet", manometerTyp: "quecksilber" }),
    ).toBe(true);
  });

  it("does not flag oscillometric / other", () => {
    expect(
      isMpbetreibV34BookException({ produktart: "messgeraet", manometerTyp: "other" }),
    ).toBe(false);
    expect(isMpbetreibV34BookException({ produktart: "messgeraet", aktiv: true })).toBe(false);
  });
});

describe("mpb appliesWhen with book exception", () => {
  it("requires book for anlage2 unless exception", () => {
    const expr = "aktiv_or_anlage2&&!buch_ausnahme";
    expect(evaluatesAppliesWhen(expr, { produktart: "x", anlage2Ziffer: "1.2.1" })).toBe(true);
    expect(
      evaluatesAppliesWhen(expr, {
        produktart: "x",
        anlage2Ziffer: "1.2.1",
        kompaktThermometer: true,
      }),
    ).toBe(false);
  });
});
