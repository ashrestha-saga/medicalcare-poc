import { describe, expect, it } from "vitest";
import { createServiceRequestSchema } from "./serviceRequest";
import { captureRequestSchema, resolveRequestSchema } from "./resolve";
import { createOrderRequestSchema } from "./orderRequest";
import { completeDutySchema, commitRegistrationSchema, registrationPreviewSchema } from "./registration";
import { createDutyAssignmentSchema, dueDatesQuerySchema } from "./dueDates";
import { requestFingerprint } from "@/services/requests/serviceRequestService";

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

describe("completeDutySchema", () => {
  it("accepts an empty body (performedAt defaults server-side)", () => {
    expect(completeDutySchema.safeParse({}).success).toBe(true);
  });

  it("rejects an overlong note", () => {
    expect(completeDutySchema.safeParse({ note: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("registration preview and commit schemas", () => {
  it("preview requires a product kind", () => {
    expect(registrationPreviewSchema.safeParse({ characteristics: { produktart: "infusor" } }).success).toBe(
      true,
    );
    expect(registrationPreviewSchema.safeParse({ characteristics: { produktart: "" } }).success).toBe(false);
  });

  it("commit requires characteristics and accepts an optional inventarize draftId", () => {
    const body = {
      tradeName: "Pump",
      manufacturer: "Acme",
      serialNumber: "SN-1",
      characteristics: { produktart: "infusor" },
      checks: {},
    };
    expect(commitRegistrationSchema.safeParse(body).success).toBe(true);
    expect(commitRegistrationSchema.safeParse({ ...body, draftId: "inst-1" }).success).toBe(true);
    expect(commitRegistrationSchema.safeParse({ ...body, characteristics: {} }).success).toBe(false);
  });
});

describe("dueDates schemas", () => {
  it("accepts an empty query and assignment body", () => {
    expect(dueDatesQuerySchema.safeParse({}).success).toBe(true);
    expect(createDutyAssignmentSchema.safeParse({}).success).toBe(true);
  });
});
