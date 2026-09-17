import { describe, expect, it } from "vitest";
import type { ClassificationRuleDTO, DeviceModelDTO } from "@/interfaces";
import { compareRules, decide } from "@/services/classification/classificationService";

const model: DeviceModelDTO = {
  id: "m1",
  basicUdiDi: "BASIC1",
  udiDi: "04012345678901",
  gtins: ["04012345678901"],
  manufacturer: "Example Medical",
  manufacturerSrn: null,
  tradeName: "Pump",
  modelName: "X200",
  riskClass: "IIb",
  emdnCode: "Z120301",
  gmdnCode: "13217",
  source: "catalog",
  sourceFetchedAt: null,
  version: 1,
  state: "released",
};

const rule = (over: Partial<ClassificationRuleDTO>): ClassificationRuleDTO => ({
  id: "r",
  matchType: "emdn",
  matchValue: "Z120301",
  annex1: true,
  annex2: false,
  softwareClass: null,
  radiation: false,
  confidence: "derived",
  source: "test",
  validFrom: null,
  validTo: null,
  ...over,
});

describe("classification decide() — Section 21", () => {
  it("returns null when no rule matches — never invents a classification", () => {
    expect(decide({ model, rules: [rule({ matchValue: "OTHER" })] })).toEqual({ proposal: null });
  });

  it("matches manufacturer+model case-insensitively", () => {
    const r = rule({ id: "mm", matchType: "manufacturerModel", matchValue: "example medical|x200", confidence: "verified" });
    const out = decide({ model, rules: [r] });
    expect(out.matchedRuleId).toBe("mm");
    expect(out.proposal?.confidence).toBe("verified");
    expect(out.proposal?.ruleId).toBe("mm");
  });

  it("prefers Basic UDI-DI over EMDN over GMDN over manufacturer+model", () => {
    const rules = [
      rule({ id: "mm", matchType: "manufacturerModel", matchValue: "Example Medical|X200", confidence: "verified" }),
      rule({ id: "gmdn", matchType: "gmdn", matchValue: "13217", confidence: "verified" }),
      rule({ id: "emdn", matchType: "emdn", matchValue: "Z120301", confidence: "guess" }),
      rule({ id: "basic", matchType: "basicUdiDi", matchValue: "basic1", confidence: "derived" }),
    ];
    expect(decide({ model, rules }).matchedRuleId).toBe("basic");
    expect(decide({ model, rules: rules.slice(0, 3) }).matchedRuleId).toBe("emdn");
    expect(decide({ model, rules: rules.slice(0, 2) }).matchedRuleId).toBe("gmdn");
  });

  it("tie-breaks same specificity by confidence, then bounded validity, then id", () => {
    const a = rule({ id: "b", confidence: "derived" });
    const b = rule({ id: "a", confidence: "derived" });
    const c = rule({ id: "c", confidence: "verified" });
    const d = rule({ id: "d", confidence: "verified", validFrom: "2024-01-01T00:00:00.000Z" });
    expect([a, b].sort(compareRules).map((r) => r.id)).toEqual(["a", "b"]);
    expect(decide({ model, rules: [a, b, c] }).matchedRuleId).toBe("c");
    expect(decide({ model, rules: [c, d] }).matchedRuleId).toBe("d");
  });

  it("ignores rules outside their validity window", () => {
    const expired = rule({ id: "old", validTo: "2020-01-01T00:00:00.000Z" });
    const future = rule({ id: "future", validFrom: "2999-01-01T00:00:00.000Z" });
    expect(decide({ model, rules: [expired, future] })).toEqual({ proposal: null });
    expect(decide({ model, rules: [expired], now: new Date("2019-06-01") }).matchedRuleId).toBe("old");
  });
});
