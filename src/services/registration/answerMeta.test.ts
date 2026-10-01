import { describe, expect, it } from "vitest";
import type { ProductKindDTO } from "./productKindTypes";
import {
  ANLAGE2_NONE,
  answerAnlage2Choice,
  answerField,
  answerMessgroesse,
  applyProductKindAsSuggestions,
  buildDecisionProtocol,
  confirmAllSuggestions,
  confirmSuggestion,
  countAnswerOrigins,
  emptyCharacteristics,
  hydrateAnswerMeta,
  unansweredVisibleFields,
} from "./answerMeta";

const kindStub = (partial: Partial<ProductKindDTO> & Pick<ProductKindDTO, "code">): ProductKindDTO => ({
  code: partial.code,
  label: partial.label ?? partial.code,
  hint: partial.hint ?? null,
  sortGroup: partial.sortGroup ?? "g",
  shows: partial.shows ?? [],
  blocks: partial.blocks ?? [],
  presets: partial.presets ?? {},
});

describe("answerMeta FA-208–216", () => {
  it("applies product-kind presets as suggestions, not answers", () => {
    const kind = kindStub({
      code: "bildgebung",
      shows: ["wartung", "stk", "strahlung", "vernetzt"],
      presets: { aktiv: true, strahlung: true, strahlenArt: "roentgen", vernetzt: true },
    });
    const m = applyProductKindAsSuggestions(kind);
    expect(m.aktiv).toBe(true);
    expect(m.answerMeta?.aktiv?.state).toBe("vorschlag");
    expect(m.wartungIntervall).toBe(12);
    expect(m.answerMeta?.wartungIntervall?.state).toBe("vorschlag");
    expect(m.zulassung).toBe("anzeige");
    expect(m.answerMeta?.zulassung?.state).toBe("vorschlag");
    expect(unansweredVisibleFields(m, kind).length).toBeGreaterThan(0);
  });

  it("confirmAllSuggestions only confirms suggestions", () => {
    const kind = kindStub({
      code: "software",
      shows: ["software", "vernetzt", "wartung"],
      presets: { software: true, vernetzt: true },
    });
    let m = applyProductKindAsSuggestions(kind);
    m = confirmAllSuggestions(m, "Ada");
    expect(m.answerMeta?.software?.state).toBe("vorschlag_bestaetigt");
    expect(m.answerMeta?.software?.confirmedBy).toBe("Ada");
    // swKlasse still open when software is true
    expect(unansweredVisibleFields(m, kind).some((f) => f.field === "swKlasse")).toBe(true);
  });

  it("clearing aktiv clears dependents (FA-214)", () => {
    let m = emptyCharacteristics();
    m.produktart = "aktiv-therapie";
    m = answerField(m, "aktiv", true, "Ada");
    m = answerField(m, "anlage1", true, "Ada");
    m = answerField(m, "aedAusnahme", true, "Ada");
    m = answerField(m, "aktiv", false, "Ada");
    expect(m.anlage1).toBeUndefined();
    expect(m.aedAusnahme).toBeUndefined();
    expect(m.answerMeta?.anlage1).toBeUndefined();
  });

  it("requires AED answer only for aktiv-therapie / sonstiges", () => {
    const therapy = kindStub({
      code: "aktiv-therapie",
      shows: ["stk", "wartung"],
      presets: { aktiv: true, anlage1: true },
    });
    let m = applyProductKindAsSuggestions(therapy);
    m = confirmAllSuggestions(m, "Ada");
    expect(unansweredVisibleFields(m, therapy).some((f) => f.field === "aedAusnahme")).toBe(true);

    const imaging = kindStub({
      code: "bildgebung",
      shows: ["stk", "wartung", "strahlung"],
      presets: { aktiv: true },
    });
    m = applyProductKindAsSuggestions(imaging);
    m = confirmAllSuggestions(m, "Ada");
    m = answerField(m, "anlage1", true, "Ada");
    expect(unansweredVisibleFields(m, imaging).some((f) => f.field === "aedAusnahme")).toBe(false);
  });

  it("changing a suggestion marks geaendert in the protocol", () => {
    let m = emptyCharacteristics();
    m = applyProductKindAsSuggestions(
      kindStub({
        code: "x",
        shows: ["wartung"],
        presets: {},
      }),
    );
    m = answerField(m, "wartungIntervall", 24, "Ada");
    const protocol = buildDecisionProtocol(m);
    const row = protocol.find((p) => p.field === "wartungIntervall");
    expect(row?.origin).toBe("geaendert");
    expect(countAnswerOrigins(protocol).changed).toBeGreaterThanOrEqual(1);
  });

  it("hydrateAnswerMeta treats legacy values as self-chosen", () => {
    const m = hydrateAnswerMeta({ produktart: "sonstiges", aktiv: true, vernetzt: false });
    expect(m.answerMeta?.aktiv?.state).toBe("selbst_gewaehlt");
    expect(m.answerMeta?.vernetzt?.state).toBe("selbst_gewaehlt");
  });

  it("anlage2 none is an explicit answered choice", () => {
    let m = emptyCharacteristics();
    m.produktart = "messgeraet";
    m = answerAnlage2Choice(m, ANLAGE2_NONE, undefined, "Ada", false);
    expect(m.answerMeta?.anlage2Choice?.state).toBe("selbst_gewaehlt");
    expect(m.messgroesse).toBe("keine");
    expect(m.anlage2ItemId).toBeUndefined();
  });

  it("messgroesse none counts as answered MTK path", () => {
    let m = emptyCharacteristics();
    m.produktart = "messgeraet";
    m = answerMessgroesse(m, "keine", "Ada");
    expect(m.answerMeta?.messgroesse?.state).toBe("selbst_gewaehlt");
    expect(m.anlage2Ziffer).toBeUndefined();
  });

  it("confirming a suggestion equals bestätigt", () => {
    let m = applyProductKindAsSuggestions(
      kindStub({
        code: "implantat",
        shows: ["implantat"],
        presets: { implantat: true },
      }),
    );
    m = confirmSuggestion(m, "implantat", "Ada");
    expect(m.answerMeta?.implantat?.state).toBe("vorschlag_bestaetigt");
    expect(buildDecisionProtocol(m)[0]?.origin).toBe("bestaetigt");
  });

  it("requires Wartung justification when interval origin is operator", () => {
    const kind = kindStub({ code: "sonstiges", shows: ["wartung"] });
    let m = applyProductKindAsSuggestions(kind);
    m = answerField(m, "wartungIntervall", 12, "Ada");
    m = answerField(m, "wartungQuelle", "eigen", "Ada");
    expect(unansweredVisibleFields(m, kind).some((f) => f.field === "wartungBegruendung")).toBe(
      true,
    );
    m = answerField(m, "wartungBegruendung", "  ", "Ada");
    expect(unansweredVisibleFields(m, kind).some((f) => f.field === "wartungBegruendung")).toBe(
      true,
    );
    m = answerField(m, "wartungBegruendung", "High intensity of use", "Ada");
    expect(unansweredVisibleFields(m, kind).some((f) => f.field === "wartungBegruendung")).toBe(
      false,
    );
    m = answerField(m, "wartungQuelle", "hersteller", "Ada");
    expect(m.wartungBegruendung).toBeUndefined();
    expect(unansweredVisibleFields(m, kind).some((f) => f.field === "wartungBegruendung")).toBe(
      false,
    );
  });
});
