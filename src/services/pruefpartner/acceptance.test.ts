import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("Prüfpartner v7 acceptance (seed)", () => {
  it("seeds 30 catalogues with 7 drafts and 2 no-catalogue", async () => {
    const total = await prisma.refInspectionCatalogue.count();
    const draft = await prisma.refInspectionCatalogue.count({ where: { draft: true } });
    const noCat = await prisma.refInspectionCatalogue.count({ where: { noCatalogue: true } });
    const steps = await prisma.refInspectionStep.count();
    expect(total).toBe(30);
    expect(draft).toBe(7);
    expect(noCat).toBe(2);
    expect(steps).toBe(216);
  });

  it("STK catalogue includes applied-part dependent step", async () => {
    const stk = await prisma.refInspectionCatalogue.findFirst({
      where: { code: "K-STK" },
      include: { steps: true },
    });
    expect(stk).toBeTruthy();
    const patientStep = stk!.steps.find((s) => s.dependsOnAppliedPart);
    expect(patientStep).toBeTruthy();
    expect(patientStep!.limitSource).toBe("applied_part");
  });

  it("BF applied-part limit is ≤ 100 µA", async () => {
    const bf = await prisma.refAppliedPartType.findUnique({ where: { code: "BF" } });
    expect(bf?.patientLeakageLimit).toBe("≤ 100");
  });
});
