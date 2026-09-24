import { describe, expect, it } from "vitest";
import { hydrateAnswerMeta } from "./answerMeta";
import {
  acknowledgeCheckRule,
  evaluateCheckRules,
  openCheckMessages,
} from "./checkRules";
import { characteristicConflicts } from "./conflicts";
import { deriveDuties } from "./deriveDuties";
import { computeDutyDueAt, dueDate, intervalUnitFromEinheits } from "./dueDate";
import { buildPrerequisites, openMandatoryPrerequisites } from "./prerequisites";
import type { RegistrationCharacteristics } from "./types";

describe("characteristicConflicts", () => {
  it("blocks implant + reprocessing", () => {
    const m: RegistrationCharacteristics = {
      produktart: "implantat",
      implantat: true,
      aufbereitung: true,
    };
    expect(characteristicConflicts(hydrateAnswerMeta(m)).length).toBeGreaterThan(0);
  });

  it("allows imaging with radiation and software once hints are acknowledged", () => {
    let m = hydrateAnswerMeta({
      produktart: "bildgebung",
      aktiv: true,
      strahlung: true,
      software: true,
      vernetzt: true,
      konstanz: [{ k: "aufnahme", intervall: "monatlich" }],
    });
    for (const hit of evaluateCheckRules(m).filter((h) => h.level === "hinweis")) {
      m = acknowledgeCheckRule(m, hit, "Ada");
    }
    expect(openCheckMessages(m)).toEqual([]);
  });
});

describe("deriveDuties", () => {
  it("always includes maintenance", () => {
    const duties = deriveDuties({ characteristics: { produktart: "sonstiges" } });
    expect(duties.some((d) => d.id === "wartung" && d.einschlaegig)).toBe(true);
  });

  it("keeps MTK row when not applicable", () => {
    const duties = deriveDuties({ characteristics: { produktart: "sonstiges", aktiv: true } });
    const mtk = duties.find((d) => d.id === "mtk");
    expect(mtk).toBeTruthy();
    expect(mtk!.einschlaegig).toBe(false);
  });

  it("requires verfahren choice for Anlage 2 1.5.3", () => {
    const without = deriveDuties({
      characteristics: { produktart: "messgeraet", anlage2Ziffer: "1.5.3" },
      annex2: {
        itemNo: "1.5.3",
        label: "Co-60",
        intervalYears: null,
        isGroup: false,
        hinweis: "No own interval.",
        wahlweiseNach: ["1.5.1", "1.5.2"],
      },
    });
    expect(without.find((d) => d.id === "mtk")?.einschlaegig).toBe(false);

    const withProc = deriveDuties({
      characteristics: { produktart: "messgeraet", anlage2Ziffer: "1.5.3", anlage2Verfahren: "1.5.1" },
      annex2: {
        itemNo: "1.5.3",
        label: "Co-60",
        intervalYears: null,
        isGroup: false,
        hinweis: "No own interval.",
        wahlweiseNach: ["1.5.1", "1.5.2"],
      },
    });
    const mtk = withProc.find((d) => d.id === "mtk")!;
    expect(mtk.einschlaegig).toBe(true);
    expect(mtk.hinweis).toContain("1.5.1");
  });

  it("creates one constancy duty per object", () => {
    const duties = deriveDuties({
      characteristics: {
        produktart: "bildgebung",
        strahlung: true,
        konstanz: [
          { k: "aufnahme", intervall: "monatlich" },
          { k: "monitor", intervall: "arbeitstaeglich" },
          { k: "dosis", intervall: "jaehrlich" },
        ],
      },
    });
    expect(duties.filter((d) => d.id.startsWith("konstanz-")).length).toBe(3);
  });

  it("uses year_end for MTK with annex2 interval", () => {
    const duties = deriveDuties({
      characteristics: { produktart: "messgeraet", aktiv: true },
      annex2: { itemNo: "1.3", label: "NIBP", intervalYears: 2, isGroup: false },
    });
    const mtk = duties.find((d) => d.id === "mtk")!;
    expect(mtk.einschlaegig).toBe(true);
    expect(mtk.frist).toBe(2);
    expect(mtk.deadlineAnchor).toBe("year_end");
    expect(mtk.vertrauen).toBe("verified");
  });

  it("does not apply STK without Anlage 1", () => {
    const duties = deriveDuties({
      characteristics: { produktart: "sonografie", aktiv: true, anlage1: false },
    });
    const stk = duties.find((d) => d.id === "stk")!;
    expect(stk.einschlaegig).toBe(false);
  });
});

describe("dueDate", () => {
  it("computes year_end for MTK", () => {
    const base = new Date(Date.UTC(2024, 2, 14));
    const due = dueDate("year_end", base, 2, "years");
    expect(due?.toISOString().slice(0, 10)).toBe("2026-12-31");
  });

  it("computes month_end for STK", () => {
    const base = new Date(Date.UTC(2024, 0, 15));
    const due = dueDate("month_end", base, 24, "months");
    expect(due?.getUTCDate()).toBeGreaterThan(27);
    expect(due?.toISOString().slice(0, 7)).toBe("2026-01");
  });

  it("clamps exact_day month overflow", () => {
    const due = dueDate("exact_day", new Date(Date.UTC(2024, 0, 31)), 1, "months");
    expect(due?.toISOString().slice(0, 10)).toBe("2024-02-29");
  });

  it("returns null for event/process/permanent/interval", () => {
    const base = new Date(Date.UTC(2024, 0, 1));
    expect(dueDate("event", base, 12, "months")).toBeNull();
    expect(dueDate("process", base, 12, "months")).toBeNull();
    expect(dueDate("permanent", base, 12, "months")).toBeNull();
    expect(dueDate("interval", base, 12, "months")).toBeNull();
  });
});

describe("computeDutyDueAt", () => {
  it("maps einheit labels (EN and legacy DE)", () => {
    expect(intervalUnitFromEinheits("months")).toBe("months");
    expect(intervalUnitFromEinheits("years")).toBe("years");
    expect(intervalUnitFromEinheits("Monate")).toBe("months");
    expect(intervalUnitFromEinheits("Jahre")).toBe("years");
  });

  it("rolls from lastCompletedAt when present", () => {
    const due = computeDutyDueAt({
      deadlineAnchor: "year_end",
      referenceDate: new Date(Date.UTC(2024, 2, 14)),
      lastCompletedAt: new Date(Date.UTC(2027, 4, 20)),
      intervalValue: 2,
      intervalUnit: "years",
    });
    expect(due?.toISOString().slice(0, 10)).toBe("2029-12-31");
  });
});

describe("prerequisites", () => {
  it("auto-satisfies bmps when not required", () => {
    const items = buildPrerequisites({ produktart: "messgeraet" }, {
      headcount: 10,
      officerRequired: false,
      officerOk: false,
      personName: null,
    });
    const bmps = items.find((i) => i.k === "bmps")!;
    expect(bmps.pflicht).toBe(false);
    expect(bmps.erfuellt).toBe(true);
  });

  it("blocks release when officer missing", () => {
    const items = buildPrerequisites({ produktart: "bildgebung", strahlung: true }, {
      headcount: 25,
      officerRequired: true,
      officerOk: false,
      personName: null,
    });
    const open = openMandatoryPrerequisites(items, { ga: true, einweisung: true, wartungsplan: true });
    expect(open.some((o) => o.k === "bmps")).toBe(true);
  });
});
