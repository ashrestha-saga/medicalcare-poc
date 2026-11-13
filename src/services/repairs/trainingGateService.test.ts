import { describe, expect, it } from "vitest";
import {
  isTrainedForManufacturer,
  manufacturerSlug,
  repairQualificationCodeForManufacturer,
} from "./trainingGateService";

describe("trainingGate manufacturer match", () => {
  it("slugs manufacturers stably", () => {
    expect(manufacturerSlug("Medisens")).toBe("medisens");
    expect(manufacturerSlug("Example Medical")).toBe("example_medical");
  });

  it("builds exact repair qual codes", () => {
    expect(repairQualificationCodeForManufacturer("Medisens")).toBe("repair_medisens");
    expect(repairQualificationCodeForManufacturer("Fresenius")).toBe("repair_fresenius");
  });

  it("accepts exact OEM code", () => {
    expect(
      isTrainedForManufacturer({
        manufacturer: "Medisens",
        holds: [{ qualificationCode: "repair_medisens", label: "Medisens" }],
      }),
    ).toBe(true);
  });

  it("rejects a different OEM repair qual", () => {
    expect(
      isTrainedForManufacturer({
        manufacturer: "Medisens",
        holds: [
          {
            qualificationCode: "repair_fresenius",
            label: "Herstellerschulung Fresenius (Instandsetzung)",
          },
        ],
      }),
    ).toBe(false);
  });

  it("accepts label that names the manufacturer", () => {
    expect(
      isTrainedForManufacturer({
        manufacturer: "Medisens",
        holds: [
          {
            qualificationCode: "repair_custom",
            label: "Herstellerschulung Medisens (Instandsetzung)",
          },
        ],
      }),
    ).toBe(true);
  });
});
