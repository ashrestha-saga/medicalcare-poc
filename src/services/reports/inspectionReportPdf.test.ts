import { describe, expect, it } from "vitest";
import { renderInspectionReportPdf, type InspectionReportPdfInput } from "./inspectionReportPdf";

const input: InspectionReportPdfInput = {
  runId: "run_1",
  tenantName: "Klinik Süd",
  assignmentReference: "REQ-1",
  catalogue: { code: "K-STK", label: "STK Prüfung", legalBasis: "§ 6 MPBetreibV" },
  device: {
    inventoryNumber: "INV-1",
    serialNumber: "SN1",
    label: "Infusomat",
    manufacturer: "ACME",
    location: "Haus A · Station 1",
  },
  performedAt: "2026-03-01",
  startedAt: "2026-03-01T08:00:00.000Z",
  completedAt: "2026-03-01T09:00:00.000Z",
  performedBy: "Max Prüfer",
  organisationName: "Prüf GmbH",
  testEquipment: { label: "Messgerät", serialNumber: "M1", traceabilityRef: "DKD-1" },
  occasion: null,
  result: "passed",
  note: "Alles ≤ Grenzwert",
  labelNumber: "L-1",
  labelNextDue: "2028-03-01",
  steps: [
    { position: 1, label: "Sichtprüfung", unit: null, limitText: null, confirmed: true, measuredValue: null, withinLimit: null, note: null },
    { position: 2, label: "Ableitstrom", unit: "µA", limitText: "≤ 500", confirmed: null, measuredValue: "120", withinLimit: true, note: null },
  ],
  signatures: [
    { kind: "inspector", signerName: "Max Prüfer", signerRole: "Prüfer", signedAt: "2026-03-01T09:00:00.000Z", absent: false, absentReason: null },
  ],
};

describe("renderInspectionReportPdf", () => {
  it("renders a PDF and is deterministic for the same sealed input", async () => {
    const a = await renderInspectionReportPdf(input);
    const b = await renderInspectionReportPdf(input);
    expect(Buffer.from(a.slice(0, 5)).toString()).toBe("%PDF-");
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
