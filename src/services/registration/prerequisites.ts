import type { EvidenceKind, PrerequisiteItem, RegistrationCharacteristics } from "./types";

export interface SiteSafetyStatus {
  headcount: number | null;
  officerRequired: boolean;
  officerOk: boolean;
  personName: string | null;
}

/** Seed/ref row shape used by buildPrerequisitesFromRef. */
export interface RefPrerequisiteRow {
  code: string;
  label: string;
  legalBasis: string;
  note: string | null;
  mandatory: boolean;
  evidenceKind: EvidenceKind;
  appliesWhen: string;
  releaseLevel: number;
}

/**
 * Evaluate appliesWhen against Merkmale.
 * Supported forms:
 * - "true" / "" → always
 * - single key: "strahlung", "aufbereitung", "software_class", "aktiv_or_anlage2",
 *   "aufb_extern", "ist_aufb_geraet", "aufb_geraete"
 * - "key==value" for string fields (e.g. strahlenArt==roentgen)
 */
export function evaluatesAppliesWhen(
  expr: string,
  m: RegistrationCharacteristics,
): boolean {
  const raw = expr.trim();
  if (!raw || raw === "true") return true;
  if (raw === "false") return false;

  if (raw.includes("&&")) {
    return raw.split("&&").every((part) => evaluatesAppliesWhen(part.trim(), m));
  }
  if (raw.includes("||")) {
    return raw.split("||").some((part) => evaluatesAppliesWhen(part.trim(), m));
  }

  if (raw.includes("!=")) {
    const [key, value] = raw.split("!=").map((s) => s.trim());
    const src = m as unknown as Record<string, unknown>;
    return String(src[key] ?? "") !== value;
  }
  if (raw.includes("==")) {
    const [key, value] = raw.split("==").map((s) => s.trim());
    const src = m as unknown as Record<string, unknown>;
    return String(src[key] ?? "") === value;
  }

  switch (raw) {
    case "strahlung":
      return Boolean(m.strahlung);
    case "aufbereitung":
      return Boolean(m.aufbereitung);
    case "software_class":
      return Boolean(m.software && m.swKlasse && m.swKlasse !== "keine");
    case "aktiv_or_anlage2":
      return Boolean(m.aktiv || m.anlage2Ziffer || m.anlage2ItemId);
    case "aufb_extern":
      return Boolean(m.aufbereitung && m.aufbExtern);
    case "ist_aufb_geraet":
      return Boolean(m.istAufbGeraet && m.eigenTyp);
    case "aufb_geraete":
      return Boolean((m.aufbGeraete ?? []).length);
    default: {
      const src = m as unknown as Record<string, unknown>;
      return Boolean(src[raw]);
    }
  }
}

/**
 * C2 — load active rule-set prerequisites → evaluate appliesWhen → merge site §6 for bmps.
 */
export function buildPrerequisitesFromRef(
  rows: RefPrerequisiteRow[],
  m: RegistrationCharacteristics,
  site: SiteSafetyStatus | null,
  evidenceByCode: Record<string, string> = {},
): PrerequisiteItem[] {
  const officerRequired = site ? site.officerRequired : false;
  const officerOk = site?.officerOk ?? false;
  const items: PrerequisiteItem[] = [];

  for (const row of rows) {
    if (!evaluatesAppliesWhen(row.appliesWhen, m)) continue;

    // Dynamic label for radiation authorisation (anzeige vs genehmigung).
    let label = row.label;
    let legalBasis = row.legalBasis;
    if (row.code === "anzeige") {
      const zul = m.zulassung ?? (m.strahlenArt === "roentgen" ? "anzeige" : "genehmigung");
      if (zul === "anzeige") {
        label = "Notification under § 19 StrlSchG completed";
        legalBasis = "§ 19 StrlSchG";
      } else {
        label = "Licence under § 12 StrlSchG on file";
        legalBasis = "§ 12 StrlSchG";
      }
    }

    if (row.code === "bmps") {
      items.push({
        k: "bmps",
        t: officerRequired
          ? "Medical device safety officer appointed and communicated"
          : "Medical device safety officer (not required with ≤ 20 employees)",
        g: row.legalBasis,
        n: row.note ?? "The duty applies when the site has more than 20 regular employees.",
        pflicht: officerRequired,
        erfuellt: officerRequired ? officerOk : true,
        evidenceKind: row.evidenceKind,
        releaseLevel: row.releaseLevel,
        evidenceId: evidenceByCode.bmps ?? null,
      });
      continue;
    }

    if (row.code === "bestand") {
      items.push({
        k: "bestand",
        t: label,
        g: legalBasis,
        n: row.note ?? "",
        pflicht: row.mandatory,
        erfuellt: true,
        evidenceKind: row.evidenceKind,
        releaseLevel: row.releaseLevel,
        evidenceId: evidenceByCode.bestand ?? null,
      });
      continue;
    }

    // Expand per-equipment validation prerequisites.
    if (row.code === "val_geraet") {
      for (const g of m.aufbGeraete ?? []) {
        const k = `val-${g}`;
        items.push({
          k,
          t: `Valid validation report (${g})`,
          g: legalBasis,
          n: row.note ?? "Validation applies to the process, not only the device.",
          pflicht: row.mandatory,
          evidenceKind: row.evidenceKind,
          releaseLevel: row.releaseLevel,
          evidenceId: evidenceByCode[k] ?? null,
        });
      }
      continue;
    }

    if (row.code === "val_eigen") {
      if (!m.istAufbGeraet || !m.eigenTyp) continue;
      const k = `val-eigen-${m.eigenTyp}`;
      items.push({
        k,
        t: label,
        g: legalBasis,
        n: row.note ?? "This product itself carries the validation duty.",
        pflicht: row.mandatory,
        evidenceKind: row.evidenceKind,
        releaseLevel: row.releaseLevel,
        evidenceId: evidenceByCode[k] ?? null,
      });
      continue;
    }

    const evidenceId = evidenceByCode[row.code] ?? null;
    items.push({
      k: row.code,
      t: label,
      g: legalBasis,
      n: row.note ?? "",
      pflicht: row.mandatory,
      erfuellt: row.evidenceKind === "confirmation" ? undefined : Boolean(evidenceId),
      evidenceKind: row.evidenceKind,
      releaseLevel: row.releaseLevel,
      evidenceId,
    });
  }

  return items;
}

/**
 * FA-501–521 prerequisites (legacy sync path). Prefer buildPrerequisitesFromRef when seed rows exist.
 * Kept for unit tests and fallback when ref table is empty.
 */
export function buildPrerequisites(
  m: RegistrationCharacteristics,
  site: SiteSafetyStatus | null,
): PrerequisiteItem[] {
  const fallback: RefPrerequisiteRow[] = FALLBACK_PREREQUISITES;
  return buildPrerequisitesFromRef(fallback, m, site);
}

/** Open mandatory items that still need operator action for the given release level. */
export function openMandatoryPrerequisites(
  items: PrerequisiteItem[],
  checks: Record<string, boolean>,
  opts?: { releaseLevel?: number; requireEvidence?: boolean },
): PrerequisiteItem[] {
  const level = opts?.releaseLevel ?? 1;
  return items.filter((x) => {
    if (!x.pflicht || x.erfuellt) return false;
    const kind = x.evidenceKind ?? "confirmation";
    if (kind === "confirmation") {
      return !checks[x.k];
    }
    if (kind === "document") {
      if (level < 2 && !opts?.requireEvidence) {
        // Level 1 may still accept checkbox for document kinds when not gating hard.
        return !checks[x.k] && !x.evidenceId;
      }
      return !x.evidenceId;
    }
    // third_party — never checkbox-satisfied
    return !x.evidenceId;
  });
}

/** Port of hard-coded list as RefPrerequisiteRow for fallback / seed source. */
export const FALLBACK_PREREQUISITES: RefPrerequisiteRow[] = [
  {
    code: "bmps",
    label: "Medical device safety officer",
    legalBasis: "§ 6 MPBetreibV",
    note: "The duty applies when the site has more than 20 regular employees.",
    mandatory: true,
    evidenceKind: "confirmation",
    appliesWhen: "true",
    releaseLevel: 1,
  },
  {
    code: "ga",
    label: "Instructions for use available and accessible at all times",
    legalBasis: "§ 4 MPBetreibV",
    note: "Prerequisite for instruction and intended use.",
    mandatory: true,
    evidenceKind: "confirmation",
    appliesWhen: "true",
    releaseLevel: 1,
  },
  {
    code: "einweisung",
    label: "Instruction in proper handling completed",
    legalBasis: "§ 4 Absatz 3 MPBetreibV",
    note: "Before first use by the operator.",
    mandatory: true,
    evidenceKind: "document",
    appliesWhen: "true",
    releaseLevel: 2,
  },
  {
    code: "wartungsplan",
    label: "Manufacturer maintenance requirements available",
    legalBasis: "§ 7 MPBetreibV",
    note: "Basis for the maintenance duty.",
    mandatory: true,
    evidenceKind: "confirmation",
    appliesWhen: "true",
    releaseLevel: 1,
  },
  {
    code: "bestand",
    label: "Entry in the inventory register",
    legalBasis: "§ 14 MPBetreibV",
    note: "Created on release in this wizard.",
    mandatory: true,
    evidenceKind: "confirmation",
    appliesWhen: "true",
    releaseLevel: 1,
  },
  {
    code: "mpb",
    label: "Medical device logbook created",
    legalBasis: "§ 13 Absatz 1 MPBetreibV",
    note: "For products under Anlage 1 and Anlage 2.",
    mandatory: true,
    evidenceKind: "confirmation",
    appliesWhen: "aktiv_or_anlage2",
    releaseLevel: 1,
  },
  {
    code: "anzeige",
    label: "Notification / licence under StrlSchG",
    legalBasis: "StrlSchG",
    note: "Regulatory prerequisite depending on the radiation application.",
    mandatory: true,
    evidenceKind: "document",
    appliesWhen: "strahlung",
    releaseLevel: 2,
  },
  {
    code: "abn",
    label: "Acceptance test completed, reference values established",
    legalBasis: "§ 115 StrlSchV",
    note: "Without reference values, a constancy test is not possible.",
    mandatory: true,
    evidenceKind: "third_party",
    appliesWhen: "strahlung",
    releaseLevel: 3,
  },
  {
    code: "ssb",
    label: "Radiation protection supervisor and radiation protection officer appointed",
    legalBasis: "§§ 69, 70 StrlSchG",
    note: "Organisational prerequisite for radiation operations.",
    mandatory: true,
    evidenceKind: "confirmation",
    appliesWhen: "strahlung",
    releaseLevel: 2,
  },
  {
    code: "fachkunde",
    label: "Radiation protection expertise demonstrated",
    legalBasis: "§ 74 StrlSchG",
    note: "For the persons carrying out the work.",
    mandatory: true,
    evidenceKind: "document",
    appliesWhen: "strahlung",
    releaseLevel: 2,
  },
  {
    code: "unterweisung",
    label: "Instruction of working persons completed",
    legalBasis: "§ 63 StrlSchV",
    note: "Before starting work and recurring thereafter.",
    mandatory: true,
    evidenceKind: "confirmation",
    appliesWhen: "strahlung",
    releaseLevel: 2,
  },
  {
    code: "ssanweisung",
    label: "Radiation protection instruction drawn up, radiation areas defined",
    legalBasis: "§ 45 StrlSchV",
    note: "Written requirement at the site.",
    mandatory: true,
    evidenceKind: "document",
    appliesWhen: "strahlung",
    releaseLevel: 2,
  },
  {
    code: "arbeitsanw",
    label: "Work instructions for the examinations performed",
    legalBasis: "§ 121 StrlSchV",
    note: "Per type of examination.",
    mandatory: true,
    evidenceKind: "document",
    appliesWhen: "strahlung",
    releaseLevel: 2,
  },
  {
    code: "vorkommnis",
    label: "Procedure for detecting and handling incidents",
    legalBasis: "§ 130 StrlSchV",
    note: "Must be demonstrable to the medical board.",
    mandatory: true,
    evidenceKind: "document",
    appliesWhen: "strahlung",
    releaseLevel: 2,
  },
  {
    code: "dosimetrie",
    label: "Personal dosimetry established for occupationally exposed persons",
    legalBasis: "StrlSchV",
    note: "According to facility size and exposure.",
    mandatory: false,
    evidenceKind: "confirmation",
    appliesWhen: "strahlung",
    releaseLevel: 2,
  },
  {
    code: "instpr",
    label: "Software installation check completed",
    legalBasis: "§ 17 MPBetreibV",
    note: "Operation only after installation check.",
    mandatory: true,
    evidenceKind: "document",
    appliesWhen: "software_class",
    releaseLevel: 2,
  },
  {
    code: "sop",
    label: "Reprocessing work instruction and validation available",
    legalBasis: "§ 8 MPBetreibV",
    note: "Written procedure and validated process.",
    mandatory: true,
    evidenceKind: "document",
    appliesWhen: "aufbereitung",
    releaseLevel: 2,
  },
  {
    code: "herstellerinfo",
    label: "Manufacturer reprocessing information available",
    legalBasis: "DIN EN ISO 17664",
    note: "Manufacturer information on reprocessing.",
    mandatory: true,
    evidenceKind: "document",
    appliesWhen: "aufbereitung",
    releaseLevel: 2,
  },
  {
    code: "vertrag",
    label: "Contract with the commissioned reprocessing provider available",
    legalBasis: "§ 8 MPBetreibV",
    note: "Responsibility remains with the operator.",
    mandatory: true,
    evidenceKind: "document",
    appliesWhen: "aufb_extern",
    releaseLevel: 2,
  },
  {
    code: "sachkunde",
    label: "Competence of reprocessing staff demonstrated",
    legalBasis: "§ 8 MPBetreibV · KRINKO/BfArM",
    note: "Scope depends on the classification.",
    mandatory: true,
    evidenceKind: "confirmation",
    appliesWhen: "aufbereitung",
    releaseLevel: 2,
  },
  {
    code: "val_geraet",
    label: "Valid validation report (equipment)",
    legalBasis: "§ 8 MPBetreibV",
    note: "Validation applies to the process, not only the device.",
    mandatory: true,
    evidenceKind: "third_party",
    appliesWhen: "aufb_geraete",
    releaseLevel: 3,
  },
  {
    code: "val_eigen",
    label: "Valid validation report for this reprocessing device",
    legalBasis: "§ 8 MPBetreibV",
    note: "This product itself carries the validation duty.",
    mandatory: true,
    evidenceKind: "third_party",
    appliesWhen: "ist_aufb_geraet",
    releaseLevel: 3,
  },
];
