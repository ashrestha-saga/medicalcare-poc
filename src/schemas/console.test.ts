import { describe, expect, it } from "vitest";
import { createClinicSchema } from "@/schemas/console";

describe("createClinicSchema", () => {
  it("normalises tenant code and handover scope aliases", () => {
    const parsed = createClinicSchema.parse({
      name: "Praxis Test",
      street: "Hauptstr. 1",
      postalCode: "53111",
      city: "Bonn",
      country: "de",
      tenantCode: "t-abc",
      siteName: "Hauptstandort",
      contactEmail: "kontakt@praxis-test.example",
      validFrom: "2026-10-01",
      billingRef: "KTO-1",
      avvRef: "AVV-2026-01",
      operatingModel: "provider_operated",
      scope: ["bestand", "fristen"],
    });
    expect(parsed.tenantCode).toBe("T-ABC");
    expect(parsed.country).toBe("DE");
    expect(parsed.street).toBe("Hauptstr. 1");
    expect(parsed.contactEmail).toBe("kontakt@praxis-test.example");
    expect(parsed.scope).toEqual(["inventory", "due-dates"]);
    expect(parsed.avvRef).toBe("AVV-2026-01");
  });

  it("requires AVV for provider_operated", () => {
    const result = createClinicSchema.safeParse({
      name: "Praxis Test",
      postalCode: "53111",
      city: "Bonn",
      tenantCode: "T-ABC",
      siteName: "Hauptstandort",
      contactEmail: "kontakt@praxis-test.example",
      validFrom: "2026-10-01",
      operatingModel: "provider_operated",
      scope: ["inventory"],
    });
    expect(result.success).toBe(false);
  });

  it("requires contact email", () => {
    const result = createClinicSchema.safeParse({
      name: "Praxis Test",
      postalCode: "53111",
      city: "Bonn",
      tenantCode: "T-ABC",
      siteName: "Hauptstandort",
      contactEmail: "",
      validFrom: "2026-10-01",
      operatingModel: "institution_operated",
      scope: ["inventory"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a tenant without a recognised scope", () => {
    const result = createClinicSchema.safeParse({
      name: "X",
      postalCode: "12345",
      city: "Y",
      tenantCode: "T-ZZ",
      siteName: "S",
      contactEmail: "x@example.com",
      validFrom: "2026-10-01",
      operatingModel: "institution_operated",
      scope: ["unknown"],
    });
    expect(result.success).toBe(false);
  });
});
