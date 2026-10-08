import { describe, expect, it } from "vitest";
import { answerField, hydrateAnswerMeta } from "./answerMeta";
import {
  acknowledgeCheckRule,
  evaluateCheckRules,
  invalidateQuittancesForFields,
  openCheckRules,
} from "./checkRules";
import type { RegistrationCharacteristics } from "./types";

function answered(partial: RegistrationCharacteristics): RegistrationCharacteristics {
  return hydrateAnswerMeta(partial);
}

describe("checkRules FA-220–224 / AC 33–38", () => {
  it("FA-301 still blocks implant + reprocessing when answered", () => {
    const hits = evaluateCheckRules(
      answered({ produktart: "implantat", implantat: true, aufbereitung: true }),
    );
    expect(hits.some((h) => h.id === "FA-301")).toBe(true);
  });

  it("FA-221 — unanswered fields do not fire contradictions", () => {
    const hits = evaluateCheckRules({
      produktart: "sonstiges",
      answerMeta: {},
      // raw values without answerMeta — hydrate will mark them; use empty
    });
    expect(hits.filter((h) => h.level === "widerspruch")).toEqual([]);
  });

  it("AC 33 — W-impl-aktiv when aktiv and implantat both yes", () => {
    const hits = evaluateCheckRules(
      answered({ produktart: "sonstiges", aktiv: true, implantat: true }),
    );
    expect(hits.some((h) => h.id === "W-impl-aktiv")).toBe(true);
  });

  it("AC 34 — W-mess-passiv for IR thermometer when not active; not for BP aneroid", () => {
    const ir = evaluateCheckRules(
      answered({
        produktart: "messgeraet",
        aktiv: false,
        messgroesse: "temperatur",
        messvariante: "infrarot",
        anlage2Ziffer: "1.2.3",
      }),
    );
    expect(ir.some((h) => h.id === "W-mess-passiv")).toBe(true);

    const bp = evaluateCheckRules(
      answered({
        produktart: "messgeraet",
        aktiv: false,
        messgroesse: "blutdruck",
        anlage2Ziffer: "1.3",
      }),
    );
    expect(bp.some((h) => h.id === "W-mess-passiv")).toBe(false);
  });

  it("AC 35 — H-medgv-jahr for legacy device with purchase year after 1998", () => {
    const hits = evaluateCheckRules(
      answered({ produktart: "sonstiges", altgeraet: true }),
      { purchaseYear: 2019 },
    );
    expect(hits.some((h) => h.id === "H-medgv-jahr")).toBe(true);
  });

  it("AC 36 — acknowledging then changing the field drops the quittance", () => {
    let m = answered({ produktart: "sonstiges", altgeraet: true });
    const hit = evaluateCheckRules(m, { purchaseYear: 2019 }).find((h) => h.id === "H-medgv-jahr");
    expect(hit).toBeTruthy();
    m = acknowledgeCheckRule(m, hit!, "Ada");
    expect(openCheckRules(m, { purchaseYear: 2019 }).some((h) => h.id === "H-medgv-jahr")).toBe(
      false,
    );
    m = answerField(m, "altgeraet", false, "Ada");
    m = answerField(m, "altgeraet", true, "Ada");
    expect(m.ruleQuittances?.["H-medgv-jahr"]).toBeUndefined();
    expect(
      openCheckRules(m, { purchaseYear: 2019 }).some((h) => h.id === "H-medgv-jahr"),
    ).toBe(true);
  });

  it("AC 37 — W-zul for radiotherapy with Anzeige", () => {
    const hits = evaluateCheckRules(
      answered({
        produktart: "therapie-strahlen",
        strahlung: true,
        strahlenArt: "therapie",
        zulassung: "anzeige",
      }),
    );
    expect(hits.some((h) => h.id === "W-zul")).toBe(true);
  });

  it("W-netz-passiv and W-instr-netz", () => {
    expect(
      evaluateCheckRules(
        answered({ produktart: "sonstiges", vernetzt: true, aktiv: false }),
      ).some((h) => h.id === "W-netz-passiv"),
    ).toBe(true);

    expect(
      evaluateCheckRules(
        answered({
          produktart: "instrument",
          aufbereitung: true,
          aufbKlasse: "kritisch",
          vernetzt: true,
        }),
      ).some((h) => h.id === "W-instr-netz"),
    ).toBe(true);
  });

  it("invalidateQuittancesForFields removes dependent entries", () => {
    const m: RegistrationCharacteristics = {
      produktart: "sonstiges",
      ruleQuittances: {
        "H-sono-aufb": {
          message: "x",
          by: "Ada",
          at: new Date().toISOString(),
          fieldIds: ["aufbereitung"],
        },
      },
    };
    const next = invalidateQuittancesForFields(m, ["aufbereitung"]);
    expect(next.ruleQuittances?.["H-sono-aufb"]).toBeUndefined();
  });

});
