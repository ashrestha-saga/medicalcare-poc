/**
 * E106 — deterministic PDF body for a sealed inspection run.
 * Pure: same input → byte-identical output (fixed dates, no random ids).
 */
import { createPdfWriter } from "./pdfText";

export type InspectionReportPdfInput = {
  runId: string;
  tenantName: string;
  assignmentReference: string | null;
  catalogue: { code: string; label: string; legalBasis: string | null };
  device: {
    inventoryNumber: string;
    serialNumber: string | null;
    label: string;
    manufacturer: string | null;
    location: string | null;
  };
  performedAt: string;
  startedAt: string | null;
  completedAt: string;
  performedBy: string;
  organisationName: string | null;
  testEquipment: { label: string; serialNumber: string | null; traceabilityRef: string | null } | null;
  occasion: string | null;
  result: string;
  note: string | null;
  labelNumber: string | null;
  labelNextDue: string | null;
  steps: Array<{
    position: number;
    label: string;
    unit: string | null;
    limitText: string | null;
    confirmed: boolean | null;
    measuredValue: string | null;
    withinLimit: boolean | null;
    note: string | null;
  }>;
  signatures: Array<{
    kind: string;
    signerName: string | null;
    signerRole: string | null;
    signedAt: string | null;
    absent: boolean;
    absentReason: string | null;
  }>;
};

const RESULT_DE: Record<string, string> = {
  passed: "Bestanden / freigegeben",
  passed_with_conditions: "Bestanden mit Auflage",
  failed: "Nicht bestanden / gesperrt",
  deviation: "Abweichung",
};

const SIGNATURE_DE: Record<string, string> = {
  institution: "Einrichtung",
  inspector: "Prüfer",
};

function stepOutcome(s: InspectionReportPdfInput["steps"][number]): string {
  if (s.measuredValue) {
    const v = `${s.measuredValue}${s.unit ? ` ${s.unit}` : ""}`;
    const lim = s.limitText ? ` (Grenzwert ${s.limitText})` : "";
    const verdict = s.withinLimit === false ? " - AUSSERHALB" : s.withinLimit === true ? " - i.O." : "";
    return `${v}${lim}${verdict}`;
  }
  if (s.confirmed === true) return "i.O.";
  if (s.confirmed === false) return "NICHT i.O.";
  return "nicht erfasst";
}

export async function renderInspectionReportPdf(input: InspectionReportPdfInput): Promise<Uint8Array> {
  const sealedAt = new Date(input.completedAt);
  const w = await createPdfWriter({
    title: `Prüfprotokoll ${input.catalogue.label}`,
    author: input.organisationName ?? input.performedBy,
    subject: `${input.device.inventoryNumber} - ${input.catalogue.code}`,
    date: sealedAt,
    footer: `${input.tenantName} - Protokoll ${input.runId}`,
  });

  w.title("Prüfprotokoll");
  w.line(input.catalogue.label, { bold: true, size: 12 });
  if (input.catalogue.legalBasis) w.line(input.catalogue.legalBasis, { size: 9 });
  w.rule();

  w.heading("Gerät");
  w.kv("Inventarnummer", input.device.inventoryNumber);
  w.kv("Bezeichnung", input.device.label);
  w.kv("Hersteller", input.device.manufacturer);
  w.kv("Seriennummer", input.device.serialNumber);
  w.kv("Standort", input.device.location);

  w.heading("Prüfung");
  w.kv("Einrichtung", input.tenantName);
  w.kv("Katalog", `${input.catalogue.code} - ${input.catalogue.label}`);
  w.kv("Auftrag", input.assignmentReference);
  w.kv("Anlass", input.occasion);
  w.kv("Prüfdatum", input.performedAt);
  w.kv("Beginn", input.startedAt);
  w.kv("Abschluss (Siegel)", input.completedAt);
  w.kv("Geprüft von", input.performedBy);
  w.kv("Prüfpartner", input.organisationName);
  if (input.testEquipment) {
    w.kv(
      "Messmittel",
      [
        input.testEquipment.label,
        input.testEquipment.serialNumber ? `SN ${input.testEquipment.serialNumber}` : null,
        input.testEquipment.traceabilityRef ? `Rückführung ${input.testEquipment.traceabilityRef}` : null,
      ]
        .filter(Boolean)
        .join(", "),
    );
  }

  w.heading("Ergebnis");
  w.line(RESULT_DE[input.result] ?? input.result, { bold: true, size: 11 });
  if (input.note) w.kv("Bemerkung", input.note);
  if (input.labelNumber) {
    w.kv("Prüfplakette", input.labelNumber);
    w.kv("Nächste Prüfung", input.labelNextDue);
  }

  w.heading("Prüfschritte");
  if (input.steps.length === 0) w.line("Keine Prüfschritte erfasst.");
  for (const s of input.steps) {
    w.line(`${s.position}. ${s.label}`, { bold: true });
    w.line(stepOutcome(s), { indent: 14 });
    if (s.note) w.line(`Bemerkung: ${s.note}`, { indent: 14, size: 9 });
  }

  w.heading("Unterschriften");
  if (input.signatures.length === 0) w.line("Keine Unterschriften erfasst.");
  for (const sig of input.signatures) {
    const who = [sig.signerName, sig.signerRole].filter(Boolean).join(", ");
    const kind = SIGNATURE_DE[sig.kind] ?? sig.kind;
    if (sig.absent) {
      w.line(`${kind}: abwesend${sig.absentReason ? ` - ${sig.absentReason}` : ""}`);
    } else {
      w.line(`${kind}: ${who || "-"}${sig.signedAt ? ` (${sig.signedAt})` : ""}`);
    }
  }

  return w.save();
}
