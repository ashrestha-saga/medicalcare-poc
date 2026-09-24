import type { PrerequisiteItem, RegistrationCharacteristics } from "./types";

export interface SiteSafetyStatus {
  headcount: number | null;
  officerRequired: boolean;
  officerOk: boolean;
  personName: string | null;
}

/**
 * FA-501–521 prerequisites. Open mandatory items block release (FA-550).
 * `bmps` is auto-set from site data when known (FA-551).
 */
export function buildPrerequisites(
  m: RegistrationCharacteristics,
  site: SiteSafetyStatus | null,
): PrerequisiteItem[] {
  const items: PrerequisiteItem[] = [];

  const officerRequired = site ? site.officerRequired : false;
  const officerOk = site?.officerOk ?? false;

  items.push({
    k: "bmps",
    t: officerRequired
      ? "Medical device safety officer appointed and communicated"
      : "Medical device safety officer (not required with ≤ 20 employees)",
    g: "§ 6 MPBetreibV",
    n: "The duty applies when the site has more than 20 regular employees.",
    pflicht: officerRequired,
    erfuellt: officerRequired ? officerOk : true,
  });

  items.push({
    k: "ga",
    t: "Instructions for use available and accessible at all times",
    g: "§ 4 MPBetreibV",
    n: "Prerequisite for instruction and intended use.",
    pflicht: true,
  });

  items.push({
    k: "einweisung",
    t: "Instruction in proper handling completed",
    g: "§ 4 Absatz 3 MPBetreibV",
    n: "Before first use by the operator.",
    pflicht: true,
  });

  items.push({
    k: "wartungsplan",
    t: "Manufacturer maintenance requirements available",
    g: "§ 7 MPBetreibV",
    n: "Basis for the maintenance duty.",
    pflicht: true,
  });

  items.push({
    k: "bestand",
    t: "Entry in the inventory register",
    g: "§ 14 MPBetreibV",
    n: "Created on release in this wizard.",
    pflicht: true,
    erfuellt: true,
  });

  if (m.aktiv || m.anlage2Ziffer || m.anlage2ItemId) {
    items.push({
      k: "mpb",
      t: "Medical device logbook created",
      g: "§ 13 Absatz 1 MPBetreibV",
      n: "For products under Anlage 1 and Anlage 2.",
      pflicht: true,
    });
  }

  if (m.strahlung) {
    const zul = m.zulassung ?? (m.strahlenArt === "roentgen" ? "anzeige" : "genehmigung");
    items.push({
      k: "anzeige",
      t: zul === "anzeige" ? "Notification under § 19 StrlSchG completed" : "Licence under § 12 StrlSchG on file",
      g: zul === "anzeige" ? "§ 19 StrlSchG" : "§ 12 StrlSchG",
      n: "Regulatory prerequisite depending on the radiation application.",
      pflicht: true,
    });
    items.push({
      k: "abn",
      t: "Acceptance test completed, reference values established",
      g: "§ 115 StrlSchV",
      n: "Without reference values, a constancy test is not possible.",
      pflicht: true,
    });
    items.push({
      k: "ssb",
      t: "Radiation protection supervisor and radiation protection officer appointed",
      g: "§§ 69, 70 StrlSchG",
      n: "Organisational prerequisite for radiation operations.",
      pflicht: true,
    });
    items.push({
      k: "fachkunde",
      t: "Radiation protection expertise demonstrated",
      g: "§ 74 StrlSchG",
      n: "For the persons carrying out the work.",
      pflicht: true,
    });
    items.push({
      k: "unterweisung",
      t: "Instruction of working persons completed",
      g: "§ 63 StrlSchV",
      n: "Before starting work and recurring thereafter.",
      pflicht: true,
    });
    items.push({
      k: "ssanweisung",
      t: "Radiation protection instruction drawn up, radiation areas defined",
      g: "§ 45 StrlSchV",
      n: "Written requirement at the site.",
      pflicht: true,
    });
    items.push({
      k: "arbeitsanw",
      t: "Work instructions for the examinations performed",
      g: "§ 121 StrlSchV",
      n: "Per type of examination.",
      pflicht: true,
    });
    items.push({
      k: "vorkommnis",
      t: "Procedure for detecting and handling incidents",
      g: "§ 130 StrlSchV",
      n: "Must be demonstrable to the medical board.",
      pflicht: true,
    });
    items.push({
      k: "dosimetrie",
      t: "Personal dosimetry established for occupationally exposed persons",
      g: "StrlSchV",
      n: "According to facility size and exposure.",
      pflicht: false,
    });
  }

  if (m.software && m.swKlasse && m.swKlasse !== "keine") {
    items.push({
      k: "instpr",
      t: "Software installation check completed",
      g: "§ 17 MPBetreibV",
      n: "Operation only after installation check.",
      pflicht: true,
    });
  }

  if (m.aufbereitung) {
    items.push({
      k: "sop",
      t: "Reprocessing work instruction and validation available",
      g: "§ 8 MPBetreibV",
      n: "Written procedure and validated process.",
      pflicht: true,
    });
    items.push({
      k: "herstellerinfo",
      t: "Manufacturer reprocessing information available",
      g: "DIN EN ISO 17664",
      n: "Manufacturer information on reprocessing.",
      pflicht: true,
    });
    if (m.aufbExtern) {
      items.push({
        k: "vertrag",
        t: "Contract with the commissioned reprocessing provider available",
        g: "§ 8 MPBetreibV",
        n: "Responsibility remains with the operator.",
        pflicht: true,
      });
    }
    items.push({
      k: "sachkunde",
      t: "Competence of reprocessing staff demonstrated",
      g: "§ 8 MPBetreibV · KRINKO/BfArM",
      n: "Scope depends on the classification.",
      pflicht: true,
    });
  }

  for (const g of m.aufbGeraete ?? []) {
    items.push({
      k: `val-${g}`,
      t: `Valid validation report (${g})`,
      g: "§ 8 MPBetreibV",
      n: "Validation applies to the process, not only the device.",
      pflicht: true,
    });
  }

  if (m.istAufbGeraet && m.eigenTyp) {
    items.push({
      k: `val-eigen-${m.eigenTyp}`,
      t: `Valid validation report for this reprocessing device`,
      g: "§ 8 MPBetreibV",
      n: "This product itself carries the validation duty.",
      pflicht: true,
    });
  }

  return items;
}

export function openMandatoryPrerequisites(
  items: PrerequisiteItem[],
  checks: Record<string, boolean>,
): PrerequisiteItem[] {
  return items.filter((x) => x.pflicht && !x.erfuellt && !checks[x.k]);
}
