import type { DerivedDuty, RegistrationCharacteristics } from "./types";

const REPROC_LABEL: Record<string, { t: string; n: string; zert: boolean }> = {
  unkritisch: { t: "Non-critical", n: "Contact with intact skin only.", zert: false },
  "semikritisch-a": { t: "Semi-critical A", n: "Contact with mucosa, without special requirements.", zert: false },
  "semikritisch-b": { t: "Semi-critical B", n: "Contact with mucosa, with special requirements.", zert: false },
  "kritisch-a": { t: "Critical A", n: "Penetrates skin or mucosa.", zert: false },
  "kritisch-b": { t: "Critical B", n: "Special requirements; QM certification required.", zert: true },
  "kritisch-c": { t: "Critical C", n: "Particularly high requirements; QM certification required.", zert: true },
};

const EQUIP: Record<
  string,
  { t: string; valNorm: string; reVal: number; reValEinheit: string; reValQuelle: string; divergent: boolean; routine: string[]; freigabe: string; hinweis?: string }
> = {
  rdg: {
    t: "Washer-disinfector (RDG)",
    valNorm: "DIN EN ISO 15883",
    reVal: 12,
    reValEinheit: "months",
    reValQuelle: "at least annually",
    divergent: false,
    routine: ["Daily: visual inspection", "Per batch: process record"],
    freigabe: "Batch release by a competent person",
  },
  klein: {
    t: "Small steriliser",
    valNorm: "DIN EN 13060 / DIN EN ISO 17665",
    reVal: 12,
    reValEinheit: "months",
    reValQuelle: "mostly annually (sources differ)",
    divergent: true,
    routine: ["Daily: vacuum and helix/Bowie-Dick test"],
    freigabe: "Batch release after record and indicator",
  },
  gross: {
    t: "Steam steriliser",
    valNorm: "DIN EN 285 / DIN EN ISO 17665",
    reVal: 12,
    reValEinheit: "months",
    reValQuelle: "recommended annually",
    divergent: false,
    routine: ["Daily: vacuum and Bowie-Dick test"],
    freigabe: "Batch release documented",
  },
  siegel: {
    t: "Pouch sealing device",
    valNorm: "DIN EN ISO 11607",
    reVal: 12,
    reValEinheit: "months",
    reValQuelle: "renewed performance qualification",
    divergent: false,
    routine: ["Daily: seal integrity check"],
    freigabe: "Visual check before start of work",
  },
};

const CONSTANCY_LABEL: Record<string, string> = {
  aufnahme: "Image receptor",
  durchl: "Fluoroscopy system",
  monitor: "Reporting monitor and viewing conditions",
  digital: "Digital image processing and output media",
  dosis: "Dose display and dose–area product",
};

export interface Annex2Lookup {
  itemNo: string;
  label: string;
  intervalYears: number | null;
  isGroup: boolean;
  restriction?: string | null;
  hinweis?: string | null;
  verfahren?: string | null;
  wahlweiseNach?: string[] | null;
}

export interface DeriveDutiesInput {
  characteristics: RegistrationCharacteristics;
  /** Selected leaf Annex 2 item (not a group). */
  annex2?: Annex2Lookup | null;
}

/**
 * Port of mockup `ableiten()` — always returns the full duty picture;
 * non-applicable rows stay with einschlaegig=false and a reason (FA-450).
 */
export function deriveDuties({ characteristics: m, annex2 }: DeriveDutiesInput): DerivedDuty[] {
  const out: DerivedDuty[] = [];

  out.push({
    id: "wartung",
    art: "Maintenance",
    titel: "Maintenance per manufacturer specification",
    grund: "§ 7 MPBetreibV",
    einschlaegig: true,
    frist: m.wartungIntervall ?? 12,
    einheit: "months",
    bezug: "tag",
    nachweis: "Maintenance report; medical device logbook entry for Anlage 1 products",
    zustaendig: m.wartungExtern ? "Commissioned service partner" : "Competent person at the facility",
    vertrauen: m.wartungQuelle === "hersteller" ? "verified" : "derived",
    hinweis:
      (m.wartungQuelle === "hersteller"
        ? "Interval from the manufacturer's instructions for use. "
        : "No manufacturer interval on file — set by the operator and must be justified. ") +
      "Unlike STK and MTK, the maintenance deadline is exact to the day.",
    inspectionTypeCode: "MAINT",
    deadlineAnchor: "exact_day",
  });

  if (m.altgeraet) {
    out.push({
      id: "stk-medgv",
      art: "STK",
      titel: "Safety inspection — legacy device",
      grund: "§ 12 MPBetreibV · MedGV Gruppe 1",
      einschlaegig: true,
      frist: 24,
      einheit: "months",
      bezug: "monatsende",
      nachweis: "Protocol, medical device logbook entry, labelling on the product",
      zustaendig: "Competent person or service partner",
      vertrauen: "derived",
      hinweis: "Placed on the market before the MPG applied (MedGV Gruppe 1).",
      inspectionTypeCode: "STK",
      deadlineAnchor: "month_end",
    });
  }

  if (m.aktiv) {
    const applicable = Boolean(m.anlage1) && !m.aedAusnahme;
    out.push({
      id: "stk",
      art: "STK",
      titel: "Safety inspection",
      grund: "§ 12 MPBetreibV" + (m.anlage1 ? " · Anlage 1" : ""),
      einschlaegig: applicable,
      frist: 24,
      einheit: "months",
      bezug: "monatsende",
      nachweis: "Protocol, medical device logbook entry, labelling on the product",
      zustaendig: "Competent person or service partner",
      vertrauen: applicable ? "derived" : "n/a",
      hinweis: m.aedAusnahme
        ? "AED in public space with self-test — exempt from STK when visual checks are documented."
        : m.anlage1
          ? "Interval per manufacturer, at latest every 24 months at month end."
          : "Not classified as an Anlage 1 product.",
      inspectionTypeCode: "STK",
      deadlineAnchor: "month_end",
    });
  }

  const z = annex2 && !annex2.isGroup ? annex2 : null;
  const verfahrenNote =
    z?.itemNo === "1.5.3" && m.anlage2Verfahren
      ? ` Selected procedure after Nr. ${m.anlage2Verfahren}.`
      : z?.verfahren
        ? ` ${z.verfahren}.`
        : "";
  const mtkFrist =
    z?.itemNo === "1.5.3" && m.anlage2Verfahren === "1.5.2"
      ? 2
      : z?.itemNo === "1.5.3" && m.anlage2Verfahren === "1.5.1"
        ? 2
        : z?.intervalYears ?? null;
  out.push({
    id: "mtk",
    art: "MTK",
    titel: "Metrological inspection",
    grund: "§ 15 MPBetreibV · Anlage 2" + (z ? ` Nr. ${z.itemNo}` : ""),
    einschlaegig: Boolean(z) && !(z?.itemNo === "1.5.3" && !m.anlage2Verfahren),
    frist: mtkFrist,
    einheit: "years",
    bezug: "jahresende",
    nachweis: "Protocol; retain until the next MTK",
    zustaendig: "Metrologically competent person or verification authority",
    vertrauen: z && !(z.itemNo === "1.5.3" && !m.anlage2Verfahren) ? "verified" : "n/a",
    hinweis: z
      ? [
          z.hinweis,
          z.restriction ? `Restriction: ${z.restriction}.` : null,
          "Deadline starts at the end of the year of commissioning or of the last MTK (year-end based).",
          verfahrenNote.trim() || null,
          z.itemNo === "1.5.3" && !m.anlage2Verfahren
            ? "Procedure after 1.5.1 or 1.5.2 must be selected — otherwise MTK remains not applicable."
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "No Anlage 2 item number assigned.",
    inspectionTypeCode: "MTK",
    deadlineAnchor: "year_end",
  });

  if (m.strahlung) {
    out.push({
      id: "abnahme",
      art: "Acceptance test",
      titel: "Acceptance test and reference value establishment",
      grund: "§ 115 StrlSchV · QS-RL",
      einschlaegig: true,
      frist: null,
      einheit: null,
      bezug: "ereignis",
      nachweis: "Test report with reference values",
      zustaendig: "Manufacturer, supplier, or X-ray specialist firm",
      vertrauen: "verified",
      hinweis: "Before first commissioning and after repairs and material changes.",
      inspectionTypeCode: "ACCEPT",
      deadlineAnchor: "event",
    });

    for (const kg of m.konstanz ?? []) {
      const label = CONSTANCY_LABEL[kg.k] ?? kg.k;
      out.push({
        id: `konstanz-${kg.k}`,
        art: "Constancy test",
        titel: `Constancy test — ${label}`,
        grund: "§ 116 StrlSchV · QS-RL X-ray diagnostics",
        einschlaegig: true,
        frist: null,
        einheit: null,
        bezug: "intervall",
        intervall: kg.intervall,
        nachweis: "Record under § 117 StrlSchV, at least ten years",
        zustaendig: "Operator, instructed staff",
        vertrauen: "derived",
        hinweis: "Cadence is separate per test object.",
        inspectionTypeCode: "CONSTANCY",
        deadlineAnchor: "interval",
        constancyObjectCode: kg.k,
      });
    }

    out.push({
      id: "sv",
      art: "Expert inspection",
      titel: "Recurring expert inspection",
      grund: "§ 88 Absatz 4 Nummer 1 StrlSchV",
      einschlaegig: true,
      frist: 5,
      einheit: "years",
      bezug: "jahresende",
      nachweis: "Certificate from the authority-appointed expert",
      zustaendig: "Authority-appointed expert",
      vertrauen: "verified",
      hinweis: "At least every five years.",
      inspectionTypeCode: "EXPERT",
      deadlineAnchor: "year_end",
    });

    out.push({
      id: "aerztl",
      art: "Medical board",
      titel: "Review by the medical board",
      grund: "§§ 128, 130 StrlSchV",
      einschlaegig: true,
      frist: null,
      einheit: null,
      bezug: "intervall",
      intervall: "as required",
      nachweis: "Requested images and records",
      zustaendig: "State medical board",
      vertrauen: "derived",
      hinweis: "The medical board requests the documentation.",
      inspectionTypeCode: "MEDBOARD",
      deadlineAnchor: "interval",
    });

    if (m.strahlenArt === "nuklear") {
      out.push({
        id: "nuklear",
        art: "Handling of radioactive substances",
        titel: "Contamination and waste monitoring",
        grund: "StrlSchG · StrlSchV",
        einschlaegig: true,
        frist: null,
        einheit: null,
        bezug: "dauerhaft",
        nachweis: "Contamination measurements; records of retention and disposal",
        zustaendig: "Radiation protection officer",
        vertrauen: "derived",
        hinweis: "Nuclear medicine: handling of radioactive substances.",
        inspectionTypeCode: "RADIOACTIVE",
        deadlineAnchor: "permanent",
      });
    }
  }

  if (m.software) {
    const sw = Boolean(m.swKlasse && m.swKlasse !== "keine");
    out.push({
      id: "itsec",
      art: "IT security review",
      titel: "IT security review",
      grund: "§ 17 MPBetreibV",
      einschlaegig: sw,
      frist: 24,
      einheit: "months",
      bezug: "monatsende",
      nachweis: "Protocol with date and result",
      zustaendig: "Operator, IT, or commissioned body",
      vertrauen: sw ? "verified" : "n/a",
      hinweis: sw
        ? "At latest every two years at month end (since August 2025)."
        : "Only for software classes IIb/III or C/D.",
      inspectionTypeCode: "ITSEC",
      deadlineAnchor: "month_end",
    });
    out.push({
      id: "install",
      art: "Installation check",
      titel: "Check of proper installation",
      grund: "§ 17 MPBetreibV",
      einschlaegig: sw,
      frist: null,
      einheit: null,
      bezug: "ereignis",
      nachweis: "Proof of check before commissioning",
      zustaendig: "Manufacturer or authorised person",
      vertrauen: sw ? "verified" : "n/a",
      hinweis: "Operation only after installation check.",
      inspectionTypeCode: "INSTALL",
      deadlineAnchor: "event",
    });
  }

  if (m.aufbereitung) {
    const e = REPROC_LABEL[m.aufbKlasse ?? "unkritisch"];
    out.push({
      id: "aufb",
      art: "Reprocessing",
      titel: "Reprocessing of reusable products",
      grund: "§ 8 MPBetreibV · KRINKO/BfArM recommendation",
      einschlaegig: true,
      frist: null,
      einheit: null,
      bezug: "prozess",
      nachweis: "Validation report, batch release protocols, work instruction",
      zustaendig: e?.zert ? "Reprocessing unit with certified QM system" : "Trained facility staff",
      vertrauen: "derived",
      hinweis: `${e?.t ?? ""}. ${e?.n ?? ""} Classification is an operator risk assessment.`,
      inspectionTypeCode: "REPROC",
      deadlineAnchor: "process",
    });

    if (m.aufbExtern) {
      out.push({
        id: "aufb-extern",
        art: "Control",
        titel: "Control of commissioned reprocessing",
        grund: "§ 8 MPBetreibV",
        einschlaegig: true,
        frist: 12,
        einheit: "months",
        bezug: "jahresende",
        nachweis: "Documentation of the operator's own control",
        zustaendig: "Operator",
        vertrauen: "verified",
        hinweis: "Responsibility does not transfer with commissioning.",
        inspectionTypeCode: "REPROC_CTRL",
        deadlineAnchor: "year_end",
      });
    }

    for (const k of m.aufbGeraete ?? []) {
      const g = EQUIP[k];
      if (!g) continue;
      out.push({
        id: `val-${k}`,
        art: "Validation",
        titel: `Validation — ${g.t}`,
        grund: `${g.valNorm} · § 8 MPBetreibV`,
        einschlaegig: true,
        frist: g.reVal,
        einheit: g.reValEinheit,
        bezug: "jahresende",
        nachweis: "Validation report with IQ, OQ and PQ",
        zustaendig: "Accredited validation service provider",
        vertrauen: g.divergent ? "derived" : "verified",
        hinweis: `Renewed performance qualification: ${g.reValQuelle}.`,
        inspectionTypeCode: "VALIDATION",
        deadlineAnchor: "year_end",
        routine: g.routine,
        freigabe: g.freigabe,
      });
    }
  }

  if (m.istAufbGeraet && m.eigenTyp) {
    const eg = EQUIP[m.eigenTyp];
    if (eg) {
      out.push({
        id: "eigen-val",
        art: "Validation",
        titel: `Validation — ${eg.t}`,
        grund: `${eg.valNorm} · § 8 MPBetreibV`,
        einschlaegig: true,
        frist: eg.reVal,
        einheit: eg.reValEinheit,
        bezug: "jahresende",
        nachweis: "Validation report with IQ, OQ and PQ",
        zustaendig: "Accredited validation service provider",
        vertrauen: eg.divergent ? "derived" : "verified",
        hinweis: `This product is itself the reprocessing device. ${eg.reValQuelle}.`,
        inspectionTypeCode: "VALIDATION",
        deadlineAnchor: "year_end",
        routine: eg.routine,
        freigabe: eg.freigabe,
      });
    }
  }

  if (m.einmalprodukt) {
    out.push({
      id: "einmal",
      art: "Single-use devices",
      titel: "Reprocessing of single-use devices",
      grund: "§ 9 MPBetreibV",
      einschlaegig: true,
      frist: null,
      einheit: null,
      bezug: "prozess",
      nachweis: "Evidence of suitability of the process",
      zustaendig: "Reprocessor with certified quality management system",
      vertrauen: "derived",
      hinweis: "Separate regulatory scope alongside § 8.",
      inspectionTypeCode: "SINGLE_USE",
      deadlineAnchor: "process",
    });
  }

  (m.zubehoer ?? []).forEach((z, i) => {
    const ze = REPROC_LABEL[z.klasse];
    out.push({
      id: `zub-${i}`,
      art: "Accessory",
      titel: `Reprocessing — ${z.t}`,
      grund: "§ 8 MPBetreibV · KRINKO/BfArM",
      einschlaegig: true,
      frist: null,
      einheit: null,
      bezug: "prozess",
      nachweis: "Own work instruction and validation for this part",
      zustaendig: ze?.zert ? "Reprocessing unit with certified QM system" : "Trained staff",
      vertrauen: "derived",
      hinweis: `${ze?.t ?? z.klasse}. A divergent classification belongs as its own inventory item.`,
      inspectionTypeCode: "REPROC",
      deadlineAnchor: "process",
    });
  });

  if (m.vernetzt) {
    out.push({
      id: "netz",
      art: "IT security measures",
      titel: "Requirements for networked products",
      grund: "§ 4 Absatz 6 MPBetreibV",
      einschlaegig: true,
      frist: null,
      einheit: null,
      bezug: "dauerhaft",
      nachweis: "Documented network connection per manufacturer specification",
      zustaendig: "Operator and IT",
      vertrauen: "verified",
      hinweis: "When connecting to a network, the manufacturer's requirements must be observed.",
      inspectionTypeCode: "NETWORK",
      deadlineAnchor: "permanent",
    });
  }

  if (m.implantat) {
    out.push({
      id: "impl",
      art: "Implant documentation",
      titel: "Documentation of implants",
      grund: "§ 16 Absatz 2 MPBetreibV · Anlage 3",
      einschlaegig: true,
      frist: null,
      einheit: null,
      bezug: "ereignis",
      nachweis: "Documentation per implantation",
      zustaendig: "Healthcare facility",
      vertrauen: "verified",
      hinweis: "Additionally implant card under Article 18 MDR.",
      inspectionTypeCode: "IMPLANT",
      deadlineAnchor: "event",
    });
  }

  return out;
}

/** Map mockup bezug labels to schema deadline anchors. */
export function bezugToAnchor(bezug: string): string {
  switch (bezug) {
    case "monatsende":
      return "month_end";
    case "jahresende":
      return "year_end";
    case "tag":
      return "exact_day";
    case "ereignis":
      return "event";
    case "intervall":
      return "interval";
    case "prozess":
      return "process";
    case "dauerhaft":
      return "permanent";
    default:
      return bezug;
  }
}
