/**
 * v17 MESSGROESSEN — operator picks what is measured; Anlage-2 digit + interval are derived (FA-203).
 */

export interface MessgroesseVariante {
  k: string;
  t: string;
  ziffer: string;
}

export interface MessgroesseDef {
  k: string;
  t: string;
  /** Direct digit when the ordinance does not subdivide. */
  ziffer?: string;
  frage?: string;
  varianten?: MessgroesseVariante[];
  hinweis?: string;
}

export const MESSGROESSEN: MessgroesseDef[] = [
  { k: "keine", t: "No measuring function under Anlage 2" },
  { k: "hoeren", t: "Hearing ability", ziffer: "1.1" },
  {
    k: "temperatur",
    t: "Body temperature",
    frage: "Thermometer design",
    varianten: [
      { k: "elektro", t: "Electrical thermometer", ziffer: "1.2.1" },
      { k: "fuehler", t: "With interchangeable temperature probes", ziffer: "1.2.2" },
      { k: "infrarot", t: "Infrared radiation thermometer (ear, forehead)", ziffer: "1.2.3" },
    ],
    hinweis: "Mercury glass thermometers with a maximum device are exempt.",
  },
  {
    k: "blutdruck",
    t: "Blood pressure, non-invasive",
    ziffer: "1.3",
    hinweis:
      "Also applies to mechanical devices with an aneroid manometer — they are not active but still subject to metrological control.",
  },
  {
    k: "augendruck",
    t: "Intraocular pressure",
    frage: "Purpose of the tonometer",
    varianten: [
      { k: "allgemein", t: "Measurement", ziffer: "1.4.1" },
      { k: "grenzwert", t: "Threshold screening", ziffer: "1.4.2" },
    ],
    hinweis:
      "The distinction follows the manufacturer's intended purpose, not the design. When in doubt, use the shorter interval.",
  },
  {
    k: "dosis_therapie",
    t: "Dose in radiotherapy",
    frage: "Energy range",
    varianten: [
      { k: "bis133", t: "Photon radiation up to 1.33 MeV", ziffer: "1.5.1" },
      { k: "ab133", t: "From 1.33 MeV or electrons from accelerators", ziffer: "1.5.2" },
    ],
  },
  { k: "dosis_diagnostik", t: "Dose in diagnostics", ziffer: "1.6" },
  { k: "ergometrie", t: "Physical workload (bicycle ergometer)", ziffer: "1.7" },
];

export function messgroesseByKey(k: string): MessgroesseDef | null {
  return MESSGROESSEN.find((x) => x.k === k) ?? null;
}

/** Derive Anlage-2 item number from Messgröße (+ optional variant). */
export function zifferAus(input: {
  messgroesse?: string | null;
  messvariante?: string | null;
}): string {
  const g = messgroesseByKey(input.messgroesse || "");
  if (!g || g.k === "keine") return "";
  if (g.ziffer) return g.ziffer;
  const v = (g.varianten || []).find((x) => x.k === input.messvariante);
  return v?.ziffer ?? "";
}

export function messgroesseNeedsVariante(key: string | undefined | null): boolean {
  const g = messgroesseByKey(key || "");
  return Boolean(g?.varianten?.length);
}

/** Reverse map for legacy drafts that only stored anlage2Ziffer. */
export function messgroesseFromZiffer(
  ziffer: string,
): { messgroesse: string; messvariante?: string } | null {
  if (!ziffer) return null;
  for (const g of MESSGROESSEN) {
    if (g.ziffer === ziffer) return { messgroesse: g.k };
    for (const v of g.varianten || []) {
      if (v.ziffer === ziffer) return { messgroesse: g.k, messvariante: v.k };
    }
  }
  return null;
}

/** Electronic measuring functions — mechanical exceptions are BP and IOP (W-mess-passiv). */
export const ELECTRONIC_MESSGROESSE: Record<string, true> = {
  hoeren: true,
  temperatur: true,
  dosis_therapie: true,
  dosis_diagnostik: true,
  ergometrie: true,
};
