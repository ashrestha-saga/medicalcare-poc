import type { PrismaClient } from "@prisma/client";

const TODAY = new Date();

/** E105 — reference IFU function checks (tenantId null, marked Referenz). */
export async function seedRoutineChecks(prisma: PrismaClient) {
  const refs: Array<{
    code: string;
    scope: "product_kind";
    productKindCode: string;
    label: string;
    cadence: "daily" | "per_use";
    checkpoints: Array<{ key: string; text: string }>;
    unit?: string;
    limitText?: string;
    basisText: string;
  }> = [
    {
      code: "ref-rc-defi-daily",
      scope: "product_kind",
      productKindCode: "defibrillator",
      label: "Defibrillator daily self-test",
      cadence: "daily",
      checkpoints: [
        { key: "indicator", text: "Ready / self-test indicator OK" },
        { key: "pads", text: "Pads / electrodes within expiry" },
      ],
      unit: "%",
      limitText: "battery ≥ 80",
      basisText: "IFU Kap. 4 — daily function check (Referenz — gegen Gebrauchsanweisung prüfen)",
    },
    {
      code: "ref-rc-anaesthesia-preuse",
      scope: "product_kind",
      productKindCode: "anaesthesia",
      label: "Anaesthesia / ventilator pre-use check",
      cadence: "per_use",
      checkpoints: [
        { key: "leak", text: "Breathing system leak test" },
        { key: "alarm", text: "Alarm test passed" },
        { key: "o2", text: "O₂ supply and sensors OK" },
      ],
      basisText: "IFU pre-use checklist (Referenz — gegen Gebrauchsanweisung prüfen)",
    },
    {
      code: "ref-rc-pump-preuse",
      scope: "product_kind",
      productKindCode: "infusion_pump",
      label: "Infusion pump pre-use check",
      cadence: "per_use",
      checkpoints: [
        { key: "visual", text: "Housing and door undamaged" },
        { key: "alarm", text: "Occlusion / door alarm test" },
      ],
      basisText: "IFU Kap. pre-use (Referenz — gegen Gebrauchsanweisung prüfen)",
    },
    {
      code: "ref-rc-us-probe-visual",
      scope: "product_kind",
      productKindCode: "ultrasound",
      label: "Ultrasound probe visual check",
      cadence: "per_use",
      checkpoints: [
        { key: "lens", text: "Lens / membrane intact" },
        { key: "cable", text: "Cable and connector undamaged" },
      ],
      basisText: "IFU probe care (Referenz — gegen Gebrauchsanweisung prüfen)",
    },
  ];

  for (const r of refs) {
    await prisma.refRoutineCheck.upsert({
      where: { code: r.code },
      update: {
        label: r.label,
        cadence: r.cadence,
        checkpointsJson: r.checkpoints,
        unit: r.unit ?? null,
        limitText: r.limitText ?? null,
        basisText: r.basisText,
        active: true,
      },
      create: {
        code: r.code,
        ruleSetId: "rs-mpbetreibv",
        scope: r.scope,
        productKindCode: r.productKindCode,
        label: r.label,
        cadence: r.cadence,
        checkpointsJson: r.checkpoints,
        unit: r.unit ?? null,
        limitText: r.limitText ?? null,
        limitSource: r.limitText ? "manufacturer" : null,
        basisText: r.basisText,
        confidence: "determination",
        determinedBy: "seed",
        determinedAt: TODAY,
        tenantId: null,
        active: true,
      },
    });
  }

  return { refs: refs.length };
}
