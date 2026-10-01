import type { DerivedDuty, DutyCategory, RegistrationCharacteristics } from "./types";

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
  {
    t: string;
    valNorm: string;
    reVal: number;
    reValEinheit: string;
    reValQuelle: string;
    /** Interval confidence — recommendation-only or disputed sources → derived. */
    confidence: "verified" | "derived";
    divergent: boolean;
    routine: string[];
    freigabe: string;
    hinweis?: string;
  }
> = {
  rdg: {
    t: "Washer-disinfector (RDG)",
    valNorm: "DIN EN ISO 15883",
    reVal: 12,
    reValEinheit: "months",
    reValQuelle: "at least annually",
    confidence: "verified",
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
    confidence: "derived",
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
    confidence: "derived",
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
    confidence: "derived",
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

const OPERATING_KEYS = new Set([
  "wartung",
  "aufb",
  "aufb-extern",
  "einmal",
  "netz",
  "impl",
]);

function dutyCategory(id: string): DutyCategory {
  if (OPERATING_KEYS.has(id) || id.startsWith("zub-") || id.startsWith("val-ref-")) {
    return "operating";
  }
  return "inspection";
}

/**
 * P1: non-applicable duties carry no interval, anchor `none`, confidence `n/a`.
 * Applied at derivation time so preview and persistence agree.
 */
function withMeta(d: DerivedDuty): DerivedDuty {
  const base: DerivedDuty = {
    ...d,
    category: d.category ?? dutyCategory(d.id),
    setsBaseline: d.setsBaseline ?? false,
    requiresBaseline: d.requiresBaseline ?? false,
  };
  if (base.einschlaegig) return base;
  return {
    ...base,
    frist: null,
    einheit: null,
    bezug: "entfaellt",
    deadlineAnchor: "none",
    vertrauen: "n/a",
    intervall: undefined,
  };
}

export interface Annex2Lookup {
  itemNo: string;
  label: string;
  intervalYears: number | null;
  isGroup: boolean;
  restriction?: string | null;
  hinweis?: string | null;
  verfahren?: string | null;
  wahlweiseNach?: string[] | null;
  /** Interval evidence — only four Anlage-2 numbers are statute-confirmed. */
  confidence?: "verified" | "derived" | null;
  sourceRef?: string | null;
}

/** P5 — radiation application reference (quality guideline / §88). */
export interface RadiationRefLookup {
  code: string;
  qualityGuideline: string | null;
  expertInspectionApplies: boolean;
}

export interface DeriveDutiesInput {
  characteristics: RegistrationCharacteristics;
  /** Selected leaf Annex 2 item (not a group). */
  annex2?: Annex2Lookup | null;
  radiationRef?: RadiationRefLookup | null;
  /**
   * AUF-01 — equipment exemplars linked to this product via ReprocessingOnDevice.
   * Validation due dates live on equipment; products only reference them.
   */
  linkedEquipmentDeviceIds?: string[];
  /** When false (unkritisch), product may link equipment without a validation due on the product. */
  requiresValidatedProcess?: boolean;
}

/**
 * Port of mockup `ableiten()` — always returns the full duty picture;
 * non-applicable rows stay with einschlaegig=false and a reason (FA-450).
 */
export function deriveDuties({
  characteristics: m,
  annex2,
  radiationRef,
  linkedEquipmentDeviceIds = [],
  requiresValidatedProcess = true,
}: DeriveDutiesInput): DerivedDuty[] {
  const out: DerivedDuty[] = [];

  // P3 — implants do not carry a maintenance calendar duty; IFU interval is a determination.
  const wartungApplicable = !m.implantat;
  out.push(
    withMeta({
      id: "wartung",
      art: "Maintenance",
      titel: "Maintenance per manufacturer specification",
      grund: "§ 7 MPBetreibV",
      einschlaegig: wartungApplicable,
      frist: wartungApplicable ? (m.wartungIntervall ?? 12) : null,
      einheit: wartungApplicable ? "months" : null,
      bezug: wartungApplicable ? "tag" : "entfaellt",
      nachweis: "Maintenance report; medical device logbook entry for Anlage 1 products",
      zustaendig: m.wartungExtern ? "Commissioned service partner" : "Competent person at the facility",
      vertrauen: wartungApplicable ? "determination" : "n/a",
      hinweis: m.implantat
        ? "Implants are not subject to a recurring maintenance duty under § 7 in this sense."
        : (m.wartungQuelle === "hersteller"
            ? "Interval from the manufacturer's instructions for use (operator determination until confirmed). "
            : "No manufacturer interval on file — set by the operator and must be justified. ") +
          "Unlike STK and MTK, the maintenance deadline is exact to the day.",
      inspectionTypeCode: "MAINT",
      deadlineAnchor: wartungApplicable ? "exact_day" : "none",
      category: "operating",
    }),
  );

  // P2 — one STK duty; Anlage 1 and MedGV grounds share the same row.
  // AED exemption (mockup): turns STK off entirely, including MedGV/Altgerät.
  const hasAnlage1Ground = Boolean(m.aktiv && m.anlage1);
  const hasMedgvGround = Boolean(m.altgeraet);
  const stkApplicable =
    !m.aedAusnahme && (hasAnlage1Ground || hasMedgvGround);
  if (m.aktiv || m.altgeraet) {
    const grounds = ["§ 12 MPBetreibV"];
    if (hasAnlage1Ground) grounds.push("Anlage 1");
    if (hasMedgvGround) grounds.push("MedGV Gruppe 1");
    out.push(
      withMeta({
        id: "stk",
        art: "STK",
        titel: hasMedgvGround && !hasAnlage1Ground ? "Safety inspection — legacy device" : "Safety inspection",
        grund: grounds.join(" · "),
        einschlaegig: stkApplicable,
        frist: stkApplicable ? 24 : null,
        einheit: stkApplicable ? "months" : null,
        bezug: stkApplicable ? "monatsende" : "entfaellt",
        nachweis: "Protocol, medical device logbook entry, labelling on the product",
        zustaendig: "Competent person or service partner",
        vertrauen: stkApplicable ? "verified" : "n/a",
        hinweis: m.aedAusnahme
          ? "AED in public space with self-test — exempt from STK when visual checks are documented."
          : stkApplicable
            ? [
                hasAnlage1Ground
                  ? "Interval per manufacturer, at latest every 24 months at month end."
                  : null,
                hasMedgvGround ? "Placed on the market before the MPG applied (MedGV Gruppe 1)." : null,
                hasAnlage1Ground && hasMedgvGround
                  ? "Both grounds apply — Anlage 1 and MedGV Gruppe 1. One inspection, one deadline."
                  : null,
              ]
                .filter(Boolean)
                .join(" ")
            : "Not classified as an Anlage 1 product and not a MedGV Gruppe 1 legacy device.",
        inspectionTypeCode: "STK",
        deadlineAnchor: stkApplicable ? "month_end" : "none",
      }),
    );
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
  const mtkApplicable = Boolean(z) && !(z?.itemNo === "1.5.3" && !m.anlage2Verfahren);
  out.push(
    withMeta({
      id: "mtk",
      art: "MTK",
      titel: "Metrological inspection",
      grund: "§ 15 MPBetreibV · Anlage 2" + (z ? ` Nr. ${z.itemNo}` : ""),
      einschlaegig: mtkApplicable,
      frist: mtkFrist,
      einheit: "years",
      bezug: "jahresende",
      nachweis: "Protocol; retain until the next MTK",
      zustaendig: "Metrologically competent person or verification authority",
      vertrauen: mtkApplicable ? (z?.confidence === "derived" ? "derived" : "verified") : "n/a",
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
    }),
  );

  if (m.strahlung) {
    const qs =
      radiationRef?.qualityGuideline?.trim() ||
      (m.strahlenArt === "roentgen" || !m.strahlenArt
        ? "QS-RL X-ray diagnostics"
        : radiationRef?.qualityGuideline ?? "Quality guideline for the radiation application");
    const expertApplies = radiationRef?.expertInspectionApplies ?? m.strahlenArt !== "nuklear";

    out.push(
      withMeta({
        id: "abnahme",
        art: "Acceptance test",
        titel: "Acceptance test and reference value establishment",
        grund: `§ 115 StrlSchV · ${qs}`,
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
        setsBaseline: true,
      }),
    );

    for (const kg of m.konstanz ?? []) {
      const label = CONSTANCY_LABEL[kg.k] ?? kg.k;
      out.push(
        withMeta({
          id: `konstanz-${kg.k}`,
          art: "Constancy test",
          titel: `Constancy test — ${label}`,
          grund: `§ 116 StrlSchV · ${qs}`,
          einschlaegig: true,
          frist: null,
          einheit: null,
          bezug: "intervall",
          intervall: kg.intervall,
          nachweis: "Record under § 117 StrlSchV, at least ten years",
          zustaendig: "Operator, instructed staff",
          vertrauen: "derived",
          hinweis: "Cadence is separate per test object. Requires a completed acceptance test (baseline).",
          inspectionTypeCode: "CONSTANCY",
          deadlineAnchor: "interval",
          constancyObjectCode: kg.k,
          requiresBaseline: true,
        }),
      );
    }

    out.push(
      withMeta({
        id: "sv",
        art: "Expert inspection",
        titel: "Recurring expert inspection",
        grund: "§ 88 Absatz 4 Nummer 1 StrlSchV",
        einschlaegig: expertApplies,
        frist: 5,
        einheit: "years",
        bezug: "jahresende",
        nachweis: "Certificate from the authority-appointed expert",
        zustaendig: "Authority-appointed expert",
        vertrauen: expertApplies ? "verified" : "n/a",
        hinweis: expertApplies
          ? "At least every five years."
          : "§ 88 applies to X-ray equipment and disturbance radiators — not to this radiation application.",
        inspectionTypeCode: "EXPERT",
        deadlineAnchor: "year_end",
      }),
    );

    out.push(
      withMeta({
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
      }),
    );

    if (m.strahlenArt === "nuklear") {
      out.push(
        withMeta({
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
          vertrauen: "verified",
          hinweis: "Nuclear medicine: handling of radioactive substances.",
          inspectionTypeCode: "RADIOACTIVE",
          deadlineAnchor: "permanent",
        }),
      );
    }
  }

  if (m.software) {
    const sw = Boolean(m.swKlasse && m.swKlasse !== "keine");
    out.push(
      withMeta({
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
      }),
    );
    out.push(
      withMeta({
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
      }),
    );
  }

  if (m.aufbereitung) {
    const e = REPROC_LABEL[m.aufbKlasse ?? "unkritisch"];
    out.push(
      withMeta({
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
        category: "operating",
      }),
    );

    if (m.aufbExtern) {
      out.push(
        withMeta({
          id: "aufb-extern",
          art: "Control",
          titel: "Control of commissioned reprocessing",
          grund: "§ 8 MPBetreibV — interval to be set by the operator",
          einschlaegig: true,
          frist: 12,
          einheit: "months",
          bezug: "jahresende",
          nachweis: "Documentation of the operator's own control",
          zustaendig: "Operator",
          vertrauen: "determination",
          hinweis: "Responsibility does not transfer with commissioning. § 8 requires control of the commissioned body; the twelve-month cadence is an operator determination.",
          inspectionTypeCode: "REPROC_CTRL",
          deadlineAnchor: "year_end",
          category: "operating",
        }),
      );
    }

    // AUF-01: do NOT emit validation calendar duties on the product for aufbGeraete.
    // Validation lives on the equipment exemplar. Products get reference rows when linked.
    if (requiresValidatedProcess && linkedEquipmentDeviceIds.length > 0 && !m.istAufbGeraet) {
      const equipmentKind = m.aufbGeraete?.[0];
      const eg = equipmentKind ? EQUIP[equipmentKind] : undefined;
      for (const equipmentId of linkedEquipmentDeviceIds) {
        out.push(
          withMeta({
            id: `val-ref-${equipmentId}`,
            art: "Validation (reference)",
            titel: "Validation — referenced reprocessing equipment",
            grund: eg
              ? `${eg.valNorm} · Leitlinie DGKH/DGSV/AKI · § 8 MPBetreibV`
              : "§ 8 MPBetreibV · AUF-01",
            einschlaegig: true,
            frist: null,
            einheit: null,
            bezug: "referenz",
            nachweis: "See validation duty on the linked reprocessing equipment",
            zustaendig: "Accredited validation service provider (on equipment)",
            vertrauen: eg?.confidence ?? "derived",
            hinweis:
              "Validation due date is carried by the linked equipment instance, not by this product.",
            inspectionTypeCode: "VALIDATION",
            deadlineAnchor: "reference",
            category: "operating",
            referenceDeviceId: equipmentId,
          }),
        );
      }
    } else if (requiresValidatedProcess && (m.aufbGeraete?.length ?? 0) > 0 && !m.istAufbGeraet) {
      // Linked equipment not yet chosen — surface as N/A reference placeholder (no due date).
      out.push(
        withMeta({
          id: "val-ref-pending",
          art: "Validation (reference)",
          titel: "Validation — link reprocessing equipment",
          grund: "§ 8 MPBetreibV · AUF-01",
          einschlaegig: false,
          frist: null,
          einheit: null,
          bezug: "referenz",
          nachweis: "Link equipment exemplars via ReprocessingOnDevice",
          zustaendig: "Operator",
          vertrauen: "n/a",
          hinweis:
            "Validation duties belong on reprocessing equipment instances. Link equipment before relying on a product validation status.",
          inspectionTypeCode: "VALIDATION",
          deadlineAnchor: "none",
          category: "operating",
        }),
      );
    }
  }

  // AUF-01 — validation calendar duty only on the equipment device itself.
  // Product decision (30.09.): repeat PQ / validation uses year_end (not exact_day).
  if (m.istAufbGeraet && m.eigenTyp) {
    const eg = EQUIP[m.eigenTyp];
    if (eg) {
      out.push(
        withMeta({
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
          vertrauen: eg.confidence,
          hinweis: `This product is itself the reprocessing device. ${eg.reValQuelle}.`,
          inspectionTypeCode: "VALIDATION",
          deadlineAnchor: "year_end",
          routine: eg.routine,
          freigabe: eg.freigabe,
        }),
      );
    }
  }

  if (m.einmalprodukt) {
    out.push(
      withMeta({
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
        category: "operating",
      }),
    );
  }

  (m.zubehoer ?? []).forEach((zItem, i) => {
    const ze = REPROC_LABEL[zItem.klasse];
    out.push(
      withMeta({
        id: `zub-${i}`,
        art: "Accessory",
        titel: `Reprocessing — ${zItem.t}`,
        grund: "§ 8 MPBetreibV · KRINKO/BfArM",
        einschlaegig: true,
        frist: null,
        einheit: null,
        bezug: "prozess",
        nachweis: "Own work instruction and validation for this part",
        zustaendig: ze?.zert ? "Reprocessing unit with certified QM system" : "Trained staff",
        vertrauen: "derived",
        hinweis: `${ze?.t ?? zItem.klasse}. A divergent classification belongs as its own inventory item.`,
        inspectionTypeCode: "REPROC",
        deadlineAnchor: "process",
        category: "operating",
      }),
    );
  });

  if (m.vernetzt) {
    out.push(
      withMeta({
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
        category: "operating",
      }),
    );
  }

  if (m.implantat) {
    out.push(
      withMeta({
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
      }),
    );
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
    case "referenz":
      return "reference";
    case "keine":
      return "none";
    default:
      return bezug;
  }
}

/** ERF-04 — release level from Merkmale max, never product-kind card alone. */
export function computeReleaseLevel(m: RegistrationCharacteristics): number {
  let level = 1;
  if (m.software && m.swKlasse && m.swKlasse !== "keine") level = Math.max(level, 2);
  if (m.strahlung) level = Math.max(level, 2);
  if (m.istAufbGeraet) level = Math.max(level, 3);
  return level;
}

/** SWOT — classification.stk must follow deriveDuties (AED exemption included), not a second expression. */
export function stkFlagFromDuties(
  duties: ReadonlyArray<Pick<DerivedDuty, "id" | "einschlaegig">>,
): boolean {
  const stk = duties.find((d) => d.id === "stk");
  return Boolean(stk?.einschlaegig);
}
