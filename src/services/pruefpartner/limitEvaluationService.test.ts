import { describe, expect, it } from "vitest";
import {
  baselineDeviationFlag,
  evaluateAgainstLimit,
  evaluateMeasurement,
  parseGermanNumber,
  parseLimitText,
} from "./limitEvaluationService";

describe("limitEvaluationService", () => {
  it("parses German decimals", () => {
    expect(parseGermanNumber("0,30")).toBe(0.3);
    expect(parseGermanNumber("2,0")).toBe(2);
  });

  it("parses limit operators", () => {
    expect(parseLimitText("≤ 0,30")).toEqual({ op: "le", value: 0.3 });
    expect(parseLimitText("≥ 2,0")).toEqual({ op: "ge", value: 2 });
    expect(parseLimitText("± 5")).toEqual({ op: "pm", value: 0, tolerance: 5 });
  });

  it("evaluates within limit", () => {
    const limit = parseLimitText("≤ 0,30")!;
    expect(evaluateAgainstLimit(0.2, limit)).toBe(true);
    expect(evaluateAgainstLimit(0.4, limit)).toBe(false);
  });

  it("flags baseline doubling within limit", () => {
    expect(baselineDeviationFlag(0.5, 0.2, true)).toBe(true);
    expect(baselineDeviationFlag(0.25, 0.2, true)).toBe(false);
  });

  it("evaluates measurement with baseline", () => {
    const r = evaluateMeasurement({
      measuredValue: "0,25",
      limitText: "≤ 0,30",
      baselineValue: "0,10",
      comparedToBaseline: true,
    });
    expect(r.withinLimit).toBe(true);
    expect(r.baselineFlag).toBe(true);
  });
});
