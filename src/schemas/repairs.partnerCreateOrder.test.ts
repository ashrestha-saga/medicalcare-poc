import { describe, expect, it } from "vitest";
import { partnerCreateOrderSchema } from "./repairs";

const base = {
  idempotencyKey: "partner-order:test-key-001",
  tenantId: "demo-tenant",
  deviceInstanceId: "instance-inv-10001",
  serviceType: "repair" as const,
  reason: "stoerung" as const,
  fulfilment: "on_site" as const,
  urgency: "immediate" as const,
  faultDescription: "Display blank",
  faultSince: "2026-09-18",
  faultConsequence: "out_of_service" as const,
  faultReportedBy: "M. Ortmann",
};

describe("partnerCreateOrderSchema", () => {
  it("accepts a Stoerung on-site repair", () => {
    expect(partnerCreateOrderSchema.safeParse(base).success).toBe(true);
  });

  it("requires workshop for send-in", () => {
    const r = partnerCreateOrderSchema.safeParse({
      ...base,
      fulfilment: "send_in",
      workshopName: null,
    });
    expect(r.success).toBe(false);
  });

  it("accepts send-in with workshop", () => {
    const r = partnerCreateOrderSchema.safeParse({
      ...base,
      fulfilment: "send_in",
      workshopName: "Sono Repair GmbH",
    });
    expect(r.success).toBe(true);
  });

  it("requires fault fields for Stoerung", () => {
    const r = partnerCreateOrderSchema.safeParse({
      ...base,
      faultDescription: "",
      faultConsequence: null,
      faultReportedBy: "",
    });
    expect(r.success).toBe(false);
  });

  it("requires appointment when urgency is at_appointment on site", () => {
    const r = partnerCreateOrderSchema.safeParse({
      ...base,
      urgency: "at_appointment",
      appointmentAt: null,
    });
    expect(r.success).toBe(false);
  });
});
