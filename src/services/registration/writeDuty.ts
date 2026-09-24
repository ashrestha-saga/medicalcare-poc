import type { Prisma } from "@prisma/client";
import { computeDutyDueAt, intervalUnitFromEinheits } from "./dueDate";
import type { DerivedDuty } from "./types";

export async function writeDuty(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    deviceInstanceId: string;
    snapshotId: string;
    duty: DerivedDuty;
    referenceDate: Date;
    /** For Wartung: roll from last service when the instance already has one. */
    lastMaintainedAt?: Date | null;
  },
) {
  const d = args.duty;
  const intervalUnit = intervalUnitFromEinheits(d.einheit);
  const dueBase =
    d.id === "wartung" && args.lastMaintainedAt ? args.lastMaintainedAt : args.referenceDate;

  await tx.deviceDuty.create({
    data: {
      tenantId: args.tenantId,
      deviceInstanceId: args.deviceInstanceId,
      snapshotId: args.snapshotId,
      dutyKey: d.id,
      inspectionTypeCode: d.inspectionTypeCode,
      deadlineAnchor: d.deadlineAnchor,
      intervalValue: d.frist,
      intervalUnit,
      cadenceLabel: d.intervall ?? null,
      constancyObjectCode: d.constancyObjectCode ?? null,
      basisText: d.grund,
      confidence: d.vertrauen === "n/a" ? "derived" : d.vertrauen,
      applicable: d.einschlaegig,
      notApplicableReason: d.einschlaegig ? null : d.hinweis,
      referenceDate: args.referenceDate,
      dueAt: computeDutyDueAt({
        deadlineAnchor: d.deadlineAnchor,
        referenceDate: dueBase,
        intervalValue: d.frist,
        intervalUnit,
      }),
      title: d.titel,
      evidenceHint: d.nachweis,
    },
  });
}
