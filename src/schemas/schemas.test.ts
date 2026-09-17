import { describe, expect, it } from "vitest";
import { createServiceRequestSchema } from "./serviceRequest";
import { captureRequestSchema, resolveRequestSchema } from "./resolve";
import { createOrderRequestSchema } from "./orderRequest";
import { assertClassificationGate, requestFingerprint } from "@/services/requests/serviceRequestService";
import { AppError } from "@/lib/errors";

const valid = {
  idempotencyKey: "11111111-2222-3333-4444-555555555555",
  subjectType: "instance" as const,
  subjectId: "instance-inv-10001",
  serviceType: "STK",
  site: "site-bonn",
  locationText: "Bonn Clinic, ICU, Room 4",
  deliveryAddress: "Central Medical Equipment Warehouse",
  raisedBy: "Anna Technik",
};

describe("request validation — Section 16", () => {
  it("accepts a complete service request", () => {
    expect(createServiceRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing idempotency key, empty location and empty delivery address", () => {
    expect(createServiceRequestSchema.safeParse({ ...valid, idempotencyKey: "" }).success).toBe(false);
    expect(createServiceRequestSchema.safeParse({ ...valid, locationText: "   " }).success).toBe(false);
    expect(createServiceRequestSchema.safeParse({ ...valid, deliveryAddress: "" }).success).toBe(false);
  });

  it("rejects unknown service types (list is fixed, FA-404)", () => {
    expect(createServiceRequestSchema.safeParse({ ...valid, serviceType: "MAGIC" }).success).toBe(false);
  });

  it("does not accept tenantId from the browser", () => {
    const parsed = resolveRequestSchema.parse({ raw: "INV-10001", context: "service", tenantId: "evil" });
    expect("tenantId" in parsed).toBe(false);
  });

  it("capture schema ignores a client-supplied serviceOnly flag", () => {
    const parsed = captureRequestSchema.parse({ name: "Pump", nameplatePhoto: "data:image/jpeg;base64,AA", serviceOnly: false });
    expect("serviceOnly" in parsed).toBe(false);
  });

  it("capture requires name and nameplate photo", () => {
    expect(captureRequestSchema.safeParse({ name: "", nameplatePhoto: "data:image/jpeg;base64,AA" }).success).toBe(false);
    expect(captureRequestSchema.safeParse({ name: "Pump", nameplatePhoto: "" }).success).toBe(false);
  });

  it("order request needs at least one item and a delivery address", () => {
    const base = { idempotencyKey: "order-key-0001", deliveryAddress: "Warehouse", raisedBy: "x", items: [{ articleNumber: "A", description: "d", quantity: 1 }] };
    expect(createOrderRequestSchema.safeParse(base).success).toBe(true);
    expect(createOrderRequestSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(createOrderRequestSchema.safeParse({ ...base, deliveryAddress: "" }).success).toBe(false);
  });
});

describe("classification gate — FA-402/404", () => {
  const proposed = { annex1: true, annex2: false, softwareClass: null, radiation: false, confidence: "verified" as const, source: "t" };

  it("verified + unconfirmed → 422", () => {
    expect(() => assertClassificationGate({ proposed, selected: [0], confirmed: false, overridden: false })).toThrowError(AppError);
    try {
      assertClassificationGate({ proposed, selected: [0], confirmed: false, overridden: false });
    } catch (e) {
      expect((e as AppError).status).toBe(422);
      expect((e as AppError).message).toBe("Please confirm the suggested inspection type.");
    }
  });

  it("verified + confirmed passes; derived never blocks; no proposal never blocks", () => {
    expect(() => assertClassificationGate({ proposed, selected: [0], confirmed: true, overridden: false })).not.toThrow();
    expect(() => assertClassificationGate({ proposed: { ...proposed, confidence: "derived" }, selected: [], confirmed: false, overridden: false })).not.toThrow();
    expect(() => assertClassificationGate(undefined)).not.toThrow();
  });
});

describe("idempotency fingerprint — 23.1", () => {
  const input = createServiceRequestSchema.parse(valid);
  it("is stable across key order and transport noise, but changes with business fields", () => {
    const a = requestFingerprint(input);
    const b = requestFingerprint({ ...input, correlationId: "different" });
    const c = requestFingerprint({ ...input, note: "now with a note" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
