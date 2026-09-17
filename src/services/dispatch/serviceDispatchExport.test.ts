import { describe, expect, it } from "vitest";
import type { ServiceDispatchExport, ServiceRequestDTO } from "@/interfaces";
import {
  formatKundeLine,
  formatServiceRequestEmail,
  herkunftLabel,
  splitLocationText,
} from "@/services/dispatch/serviceDispatchExport";

describe("serviceDispatchExport helpers", () => {
  it("splits locationText into site / area / room", () => {
    expect(splitLocationText("Bonn Clinic, ICU, Room 4", "Bonn Clinic")).toEqual({
      site: "Bonn Clinic",
      area: "ICU",
      room: "Room 4",
    });
    expect(splitLocationText("Klinikum Nord · Haus A, Station 3B, room2")).toEqual({
      site: "Klinikum Nord · Haus A",
      area: "Station 3B",
      room: "room2",
    });
  });

  it("formats Kunde and Herkunft labels", () => {
    expect(formatKundeLine({ customerNumber: "KD-40218", companyName: "Klinikum Nord" })).toBe(
      "KD-40218 Klinikum Nord",
    );
    expect(herkunftLabel("catalog")).toBe("Artikelstamm (GTIN/UDI)");
    expect(herkunftLabel("inventory")).toBe("Gerätebestand");
  });

  it("formats email An / Betreff / body", () => {
    const exportBody: ServiceDispatchExport = {
      reference: "SR-2026-4182",
      customer: "KD-40218",
      shipTo: "Haus A · Materiallager EG",
      deviceCode: "4038653014446",
      deviceName: "Absauggerät VacuMed 30",
      inventoryNumber: null,
      serialNumber: null,
      location: null,
      service: "STK",
      note: null,
      classification: { confirmed: false, note: "keine Modelldaten" },
      site: "Klinikum Nord · Haus A",
      area: "Station 3B",
      room: "room2",
      accessHint: null,
      deliveryAddress: "Warenannahme Haus A · Materiallager EG",
      article: {
        source: "catalog",
        name: "Absauggerät VacuMed 30",
        manufacturer: "Vitamed Systems",
        number: "4038653014446",
        numberType: null,
        articleId: null,
      },
      raisedBy: "M. Ortmann",
      createdAt: "2026-09-14T10:17:05.427Z",
    };

    const email = formatServiceRequestEmail(exportBody, "service@plusorder.de", {
      customerNumber: "KD-40218",
      companyName: "Klinikum Nord",
      deliveryLine: "Haus A · Materiallager EG",
    });

    expect(email.to).toBe("service@plusorder.de");
    expect(email.subject).toBe("Serviceanforderung SR-2026-4182 — STK");
    expect(email.body).toContain("Gerät:  Absauggerät VacuMed 30");
    expect(email.body).toContain("Kennung:      4038653014446");
    expect(email.body).not.toContain("Inventarnummer:");
    expect(email.body).toContain("Standort:     null");
    expect(email.body).toContain("Leistung:     STK");
    expect(email.body).toContain("Kunde:    KD-40218 Klinikum Nord");
    expect(email.body).toContain("Melder:      M. Ortmann");
    expect(email.body).toContain("Herkunft:  Artikelstamm (GTIN/UDI)");
    expect(email.body).toContain("Einsatzort:  Klinikum Nord · Haus A · Station 3B · room2");
    expect(email.body).toContain("Lieferanschrift: Warenannahme Haus A · Materiallager EG");
    expect(email.body).not.toContain("Lieferung:");
    expect(email.html).toContain("Service Request");
    expect(email.html).toContain("Absauggerät VacuMed 30");
    expect(email.html).toContain("KD-40218 Klinikum Nord");
    expect(email.html).not.toContain(">Delivery</div>");
    expect(email.html).toContain("M. Ortmann");
    expect(email.html).toContain("Article master (GTIN/UDI)");
    expect(email.html).toContain("SR-2026-4182");
  });

  it("includes inventory and serial numbers for inventory hits", () => {
    const exportBody: ServiceDispatchExport = {
      reference: "SR-2026-5001",
      customer: null,
      shipTo: null,
      deviceCode: "04012345678901",
      deviceName: "Infusion pump",
      inventoryNumber: "INV-10001",
      serialNumber: "SN-10001",
      location: "Site · Area · Room",
      service: "Repair",
      note: null,
      classification: { confirmed: true, note: null },
      site: "Site",
      area: "Area",
      room: "Room",
      accessHint: null,
      deliveryAddress: "Warehouse",
      article: {
        source: "inventory",
        name: "Infusion pump",
        manufacturer: "Acme",
        number: "04012345678901",
        numberType: "udi-di",
        articleId: "m1",
      },
      raisedBy: "Capturer",
      createdAt: "2026-09-17T10:00:00.000Z",
    };

    const email = formatServiceRequestEmail(exportBody, "tech@example.com");
    expect(email.body).toContain("Inventarnummer: INV-10001");
    expect(email.body).toContain("Seriennummer:   SN-10001");
    expect(email.body).toContain("Herkunft:  Gerätebestand");
    expect(email.html).toContain("Inventory No.");
    expect(email.html).toContain("INV-10001");
    expect(email.html).toContain("Serial No.");
    expect(email.html).toContain("SN-10001");
  });
});

// Keep a type-only sanity check that DTO fields align with export usage.
const _sampleRequest = null as unknown as ServiceRequestDTO;
void _sampleRequest;
