import { describe, expect, it } from "vitest";
import { formatSiteAddress } from "@/services/console/clinicOnboardService";

describe("formatSiteAddress", () => {
  it("builds a display line from structured parts", () => {
    expect(
      formatSiteAddress({
        street: "Hauptstr. 1",
        postalCode: "53111",
        city: "Bonn",
        country: "DE",
      }),
    ).toBe("Hauptstr. 1, 53111 Bonn");
  });

  it("includes non-DE country", () => {
    expect(
      formatSiteAddress({
        street: null,
        postalCode: "8000",
        city: "Zürich",
        country: "CH",
      }),
    ).toBe("8000 Zürich, CH");
  });
});
