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
      validFrom: "2026-10-01",
      billingRef: "KTO-1",
      operatingModel: "provider_operated",
      scope: ["bestand", "fristen"],
    });
    expect(parsed.tenantCode).toBe("T-ABC");
    expect(parsed.country).toBe("DE");
    expect(parsed.street).toBe("Hauptstr. 1");
    expect(parsed.scope).toEqual(["inventory", "due-dates"]);
  });

  it("rejects a tenant without a recognised scope", () => {
    const result = createClinicSchema.safeParse({
      name: "X",
      city: "Y",
      tenantCode: "T-ZZ",
      siteName: "S",
      validFrom: "2026-10-01",
      operatingModel: "institution_operated",
      scope: ["unknown"],
    });
    expect(result.success).toBe(false);
  });
});
