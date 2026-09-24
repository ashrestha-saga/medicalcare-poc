import { describe, expect, it } from "vitest";
import {
  answerMessgroesse,
  answerMessvariante,
  emptyCharacteristics,
  hydrateAnswerMeta,
  unansweredVisibleFields,
} from "./answerMeta";
import {
  messgroesseFromZiffer,
  zifferAus,
} from "./messgroessen";
import type { ProductKindDTO } from "./productKindTypes";

const messKind: ProductKindDTO = {
  code: "messgeraet",
  label: "Messgerät",
  hint: null,
  sortGroup: "g",
  shows: ["mtk", "stk", "wartung"],
  blocks: [],
  presets: {},
};

describe("messgroessen / zifferAus (FA-203)", () => {
  it("derives blood pressure digit without a variant question", () => {
    expect(zifferAus({ messgroesse: "blutdruck" })).toBe("1.3");
  });

  it("requires thermometer design before deriving a digit", () => {
    expect(zifferAus({ messgroesse: "temperatur" })).toBe("");
    expect(zifferAus({ messgroesse: "temperatur", messvariante: "infrarot" })).toBe("1.2.3");
  });

  it("maps legacy Anlage-2 digits back to Messgröße", () => {
    expect(messgroesseFromZiffer("1.3")).toEqual({ messgroesse: "blutdruck" });
    expect(messgroesseFromZiffer("1.2.3")).toEqual({
      messgroesse: "temperatur",
      messvariante: "infrarot",
    });
  });

  it("answerMessgroesse sets derived ziffer and blocks unanswered variante", () => {
    let m = emptyCharacteristics();
    m.produktart = "messgeraet";
    m = answerMessgroesse(m, "temperatur", "Ada");
    expect(m.messgroesse).toBe("temperatur");
    expect(m.anlage2Ziffer).toBeUndefined();
    expect(unansweredVisibleFields(m, messKind).some((f) => f.field === "messvariante")).toBe(
      true,
    );

    m = answerMessvariante(m, "infrarot", "Ada", [
      { id: "a2-123", itemNo: "1.2.3", wahlweiseNach: null },
    ]);
    expect(m.anlage2Ziffer).toBe("1.2.3");
    expect(m.anlage2ItemId).toBe("a2-123");
  });

  it("hydrate maps legacy anlage2Ziffer onto messgroesse", () => {
    const m = hydrateAnswerMeta({
      produktart: "messgeraet",
      anlage2Ziffer: "1.3",
    });
    expect(m.messgroesse).toBe("blutdruck");
    expect(m.answerMeta?.messgroesse?.state).toBe("selbst_gewaehlt");
  });
});
