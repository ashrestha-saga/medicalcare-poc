import { describe, expect, it } from "vitest";
import { computeInstructionMatrix, computeValidUntil } from "./trainingService";
import { createTrainingEventSchema } from "@/schemas/training";

describe("computeInstructionMatrix", () => {
  const staff = [
    { id: "p1", name: "S. Berger" },
    { id: "p2", name: "T. Wenzel" },
  ];
  const models = [
    { id: "m-x200", name: "VOLUMAT X-200", productSeries: "VOLUMAT X" },
    { id: "m-x210", name: "VOLUMAT X-210", productSeries: "VOLUMAT X" },
    { id: "m-vent", name: "Vent 5", productSeries: "Vent" },
  ];

  it("marks direct instruction and series equivalence", () => {
    const cells = computeInstructionMatrix(staff, models, [
      { personId: "p1", modelId: "m-x200" },
    ]);
    const p1 = cells.filter((c) => c.personId === "p1");
    expect(p1.find((c) => c.modelId === "m-x200")?.status).toBe("instructed");
    expect(p1.find((c) => c.modelId === "m-x210")?.status).toBe("equivalent_series");
    expect(p1.find((c) => c.modelId === "m-vent")?.status).toBe("open");
  });

  it("leaves uninstructed people open on all models", () => {
    const cells = computeInstructionMatrix(staff, models, []);
    expect(cells.every((c) => c.status === "open")).toBe(true);
  });
});

describe("computeValidUntil", () => {
  it("returns null when the type has no expiry", () => {
    expect(computeValidUntil(new Date("2024-03-14T00:00:00.000Z"), null)).toBeNull();
  });

  it("adds calendar months for recurring briefings", () => {
    const until = computeValidUntil(new Date("2025-04-09T00:00:00.000Z"), 12);
    expect(until?.toISOString().slice(0, 10)).toBe("2026-04-09");
  });
});

describe("createTrainingEventSchema", () => {
  const base = {
    trainingTypeCode: "einweisung11",
    subjectModelId: "m1",
    heldOn: "2026-09-24",
    instructorName: "Vitamed",
    instructorQualification: "Manufacturer",
    basisDocument: "IFU Rev. 4",
    mode: "group" as const,
    personIds: ["p1", "p2"],
  };

  it("accepts a valid group payload", () => {
    expect(createTrainingEventSchema.parse(base).personIds).toHaveLength(2);
  });

  it("rejects individual mode with multiple participants", () => {
    const result = createTrainingEventSchema.safeParse({
      ...base,
      mode: "individual",
      personIds: ["p1", "p2"],
    });
    expect(result.success).toBe(false);
  });
});
