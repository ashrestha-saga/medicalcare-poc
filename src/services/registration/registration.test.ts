import { describe, expect, it } from "vitest";
import { hydrateAnswerMeta } from "./answerMeta";
import {
  acknowledgeCheckRule,
  evaluateCheckRules,
  openCheckMessages,
} from "./checkRules";
import { characteristicConflicts } from "./conflicts";
import { deriveDuties, stkFlagFromDuties } from "./deriveDuties";
import { computeDutyDueAt, dueDate, intervalUnitFromEinheits } from "./dueDate";
import { buildPrerequisites, evaluatesAppliesWhen, openMandatoryPrerequisites } from "./prerequisites";
import { isReprocessingEquipmentDevice } from "./reprocessingLinkService";
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
    const wartung = duties.find((d) => d.id === "wartung")!;
    expect(wartung.einschlaegig).toBe(true);
    expect(wartung.vertrauen).toBe("determination");
    expect(wartung.category).toBe("operating");
  });

  it("keeps MTK row when not applicable (P1 clears interval/anchor)", () => {
    const duties = deriveDuties({ characteristics: { produktart: "sonstiges", aktiv: true } });
    const mtk = duties.find((d) => d.id === "mtk");
    expect(mtk).toBeTruthy();
    expect(mtk!.einschlaegig).toBe(false);
    expect(mtk!.deadlineAnchor).toBe("none");
    expect(mtk!.frist).toBeNull();
    expect(mtk!.vertrauen).toBe("n/a");
  });

  it("does not apply maintenance to implants (P3)", () => {
    const duties = deriveDuties({
      characteristics: { produktart: "implantat", implantat: true },
    });
    const wartung = duties.find((d) => d.id === "wartung")!;
    expect(wartung.einschlaegig).toBe(false);
    expect(wartung.deadlineAnchor).toBe("none");
    expect(wartung.vertrauen).toBe("n/a");
  });

  it("merges Anlage 1 and MedGV into one STK duty (P2)", () => {
    const both = deriveDuties({
      characteristics: {
        produktart: "bildgebung",
        aktiv: true,
        anlage1: true,
        altgeraet: true,
      },
    });
    expect(both.filter((d) => d.id === "stk" || d.id === "stk-medgv")).toHaveLength(1);
    const stk = both.find((d) => d.id === "stk")!;
    expect(stk.einschlaegig).toBe(true);
    expect(stk.grund).toContain("Anlage 1");
    expect(stk.grund).toContain("MedGV");

    const legacyOnly = deriveDuties({
      characteristics: { produktart: "bildgebung", altgeraet: true },
    });
    expect(legacyOnly.find((d) => d.id === "stk")?.einschlaegig).toBe(true);
    expect(legacyOnly.some((d) => d.id === "stk-medgv")).toBe(false);
  });

  it("AED exemption turns STK off even with MedGV/Altgerät (mockup)", () => {
    const duties = deriveDuties({
      characteristics: {
        produktart: "aktiv-therapie",
        aktiv: true,
        anlage1: true,
        altgeraet: true,
        aedAusnahme: true,
      },
    });
    const stk = duties.find((d) => d.id === "stk")!;
    expect(stk.einschlaegig).toBe(false);
    expect(stk.deadlineAnchor).toBe("none");
    expect(stk.frist).toBeNull();
    expect(stk.grund).toContain("Anlage 1");
    expect(stk.grund).toContain("MedGV");
    expect(stkFlagFromDuties(duties)).toBe(false);
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
      annex2: {
        itemNo: "1.3",
        label: "NIBP",
        intervalYears: 2,
        isGroup: false,
        confidence: "verified",
      },
    });
    const mtk = duties.find((d) => d.id === "mtk")!;
    expect(mtk.einschlaegig).toBe(true);
    expect(mtk.frist).toBe(2);
    expect(mtk.deadlineAnchor).toBe("year_end");
    expect(mtk.vertrauen).toBe("verified");
  });

  it("marks unconfirmed Anlage-2 intervals as derived", () => {
    const duties = deriveDuties({
      characteristics: { produktart: "messgeraet", aktiv: true },
      annex2: {
        itemNo: "1.2.1",
        label: "Elektrothermometer",
        intervalYears: 2,
        isGroup: false,
        confidence: "derived",
      },
    });
    expect(duties.find((d) => d.id === "mtk")?.vertrauen).toBe("derived");
  });

  it("marks STK and nuclear as verified; outsourced control as determination", () => {
    const stk = deriveDuties({
      characteristics: { produktart: "aktiv-therapie", aktiv: true, anlage1: true },
    }).find((d) => d.id === "stk")!;
    expect(stk.einschlaegig).toBe(true);
    expect(stk.vertrauen).toBe("verified");

    const nuklear = deriveDuties({
      characteristics: { produktart: "nuklear", strahlung: true, strahlenArt: "nuklear" },
      radiationRef: {
        code: "nuklear",
        qualityGuideline: "QS-RL Nuklearmedizin",
        expertInspectionApplies: false,
      },
    }).find((d) => d.id === "nuklear")!;
    expect(nuklear.vertrauen).toBe("verified");

    const control = deriveDuties({
      characteristics: {
        produktart: "instrument",
        aufbereitung: true,
        aufbKlasse: "kritisch-a",
        aufbExtern: true,
      },
      requiresValidatedProcess: true,
    }).find((d) => d.id === "aufb-extern")!;
    expect(control.vertrauen).toBe("determination");
    expect(control.frist).toBe(12);
  });

  it("does not apply STK without Anlage 1", () => {
    const duties = deriveDuties({
      characteristics: { produktart: "sonografie", aktiv: true, anlage1: false },
    });
    const stk = duties.find((d) => d.id === "stk")!;
    expect(stk.einschlaegig).toBe(false);
    expect(stk.deadlineAnchor).toBe("none");
    expect(stk.frist).toBeNull();
  });

  it("marks Abnahme as baseline and Konstanz as requiring baseline", () => {
    const duties = deriveDuties({
      characteristics: {
        produktart: "bildgebung",
        strahlung: true,
        konstanz: [{ k: "aufnahme", intervall: "monatlich" }],
      },
    });
    expect(duties.find((d) => d.id === "abnahme")?.setsBaseline).toBe(true);
    expect(duties.find((d) => d.id === "konstanz-aufnahme")?.requiresBaseline).toBe(true);
    expect(duties.find((d) => d.id === "wartung")?.category).toBe("operating");
  });

  it("uses radiation ref for QS guideline and §88 applicability (P5)", () => {
    const nuklear = deriveDuties({
      characteristics: { produktart: "nuklear", strahlung: true, strahlenArt: "nuklear" },
      radiationRef: {
        code: "nuklear",
        qualityGuideline: "QS-RL Nuklearmedizin",
        expertInspectionApplies: false,
      },
    });
    const sv = nuklear.find((d) => d.id === "sv")!;
    expect(sv.einschlaegig).toBe(false);
    expect(sv.deadlineAnchor).toBe("none");
    expect(sv.frist).toBeNull();
    expect(nuklear.find((d) => d.id === "abnahme")?.grund).toContain("QS-RL Nuklearmedizin");
  });

  it("puts validation due only on equipment, not on products with aufbGeraete (AUF-01)", () => {
    const product = deriveDuties({
      characteristics: {
        produktart: "instrument",
        aufbereitung: true,
        aufbKlasse: "kritisch-a",
        aufbGeraete: ["rdg", "klein"],
      },
      requiresValidatedProcess: true,
    });
    expect(product.some((d) => d.id.startsWith("val-") && d.deadlineAnchor === "year_end")).toBe(
      false,
    );
    expect(product.find((d) => d.id === "val-ref-pending")?.einschlaegig).toBe(false);

    const linked = deriveDuties({
      characteristics: {
        produktart: "instrument",
        aufbereitung: true,
        aufbKlasse: "kritisch-a",
        aufbGeraete: ["rdg"],
      },
      linkedEquipmentDeviceIds: ["equip-1"],
      requiresValidatedProcess: true,
    });
    const ref = linked.find((d) => d.id === "val-ref-equip-1")!;
    expect(ref.einschlaegig).toBe(true);
    expect(ref.deadlineAnchor).toBe("reference");
    expect(ref.referenceDeviceId).toBe("equip-1");
    expect(ref.category).toBe("operating");
    expect(ref.vertrauen).toBe("verified");

    const equipment = deriveDuties({
      characteristics: {
        produktart: "aufbereitungsgeraet",
        istAufbGeraet: true,
        eigenTyp: "rdg",
      },
    });
    expect(equipment.find((d) => d.id === "eigen-val")?.einschlaegig).toBe(true);
    expect(equipment.find((d) => d.id === "eigen-val")?.deadlineAnchor).toBe("year_end");
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

  it("returns null for event/process/permanent/interval/none/reference", () => {
    const base = new Date(Date.UTC(2024, 0, 1));
    expect(dueDate("event", base, 12, "months")).toBeNull();
    expect(dueDate("process", base, 12, "months")).toBeNull();
    expect(dueDate("permanent", base, 12, "months")).toBeNull();
    expect(dueDate("interval", base, 12, "months")).toBeNull();
    expect(dueDate("none", base, 12, "months")).toBeNull();
    expect(dueDate("reference", base, 12, "months")).toBeNull();
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

  it("never treats third_party as checkbox-satisfied", () => {
    const items = buildPrerequisites(
      { produktart: "bildgebung", strahlung: true, strahlenArt: "roentgen" },
      null,
    );
    const abn = items.find((i) => i.k === "abn")!;
    expect(abn.evidenceKind).toBe("third_party");
    const open = openMandatoryPrerequisites(items, { abn: true }, { releaseLevel: 3, requireEvidence: true });
    expect(open.some((i) => i.k === "abn")).toBe(true);
  });
});

describe("evaluatesAppliesWhen", () => {
  const base: RegistrationCharacteristics = { produktart: "bildgebung" };

  it("supports true/false and named keys", () => {
    expect(evaluatesAppliesWhen("true", base)).toBe(true);
    expect(evaluatesAppliesWhen("false", base)).toBe(false);
    expect(evaluatesAppliesWhen("strahlung", { ...base, strahlung: true })).toBe(true);
    expect(evaluatesAppliesWhen("strahlung", base)).toBe(false);
  });

  it("supports == / != and boolean combinators", () => {
    expect(evaluatesAppliesWhen("strahlenArt==roentgen", { ...base, strahlenArt: "roentgen" })).toBe(true);
    expect(evaluatesAppliesWhen("strahlenArt!=nuklear", { ...base, strahlenArt: "roentgen" })).toBe(true);
    expect(evaluatesAppliesWhen("strahlung && vernetzt", { ...base, strahlung: true, vernetzt: true })).toBe(
      true,
    );
    expect(evaluatesAppliesWhen("strahlung || vernetzt", { ...base, vernetzt: true })).toBe(true);
  });

  it("supports reprocessing equipment keys", () => {
    expect(
      evaluatesAppliesWhen("ist_aufb_geraet", { ...base, istAufbGeraet: true, eigenTyp: "rdg" }),
    ).toBe(true);
    expect(evaluatesAppliesWhen("aufb_geraete", { ...base, aufbGeraete: ["rdg"] })).toBe(true);
  });
});

describe("isReprocessingEquipmentDevice", () => {
  it("accepts product kind aufbereitungsgeraet", () => {
    expect(
      isReprocessingEquipmentDevice({
        productKindCode: "aufbereitungsgeraet",
        characteristicsJson: null,
      }),
    ).toBe(true);
  });

  it("accepts Merkmale istAufbGeraet + eigenTyp", () => {
    expect(
      isReprocessingEquipmentDevice({
        productKindCode: "sonstiges",
        characteristicsJson: JSON.stringify({ istAufbGeraet: true, eigenTyp: "rdg" }),
      }),
    ).toBe(true);
  });

  it("rejects ordinary products", () => {
    expect(
      isReprocessingEquipmentDevice({
        productKindCode: "instrument",
        characteristicsJson: JSON.stringify({ aufbereitung: true, aufbKlasse: "kritisch-a" }),
      }),
    ).toBe(false);
  });
});
