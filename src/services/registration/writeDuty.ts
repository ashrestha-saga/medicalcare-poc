import type { Prisma } from "@prisma/client";
import { computeDutyDueAt } from "./dueDate";
import { canonicalDutyKey, toIntervalUnit } from "./dutyKeys";
import type { DerivedDuty } from "./types";

function mapConfidence(vertrauen: DerivedDuty["vertrauen"], applicable: boolean): string {
  if (!applicable || vertrauen === "n/a" || vertrauen === "not_applicable") {
    return "not_applicable";
  }
  if (vertrauen === "guess") return "derived";
  return vertrauen;
}

/**
 * Persist a derived duty row.
 * P1: applicable=false ⇒ no due date, anchor none, confidence not_applicable, clear intervals.
 */
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
  const applicable = d.einschlaegig;
  const dutyKey = canonicalDutyKey(d.id);

  if (!applicable) {
    await tx.deviceDuty.create({
      data: {
        tenantId: args.tenantId,
        deviceInstanceId: args.deviceInstanceId,
        snapshotId: args.snapshotId,
        dutyKey,
        inspectionTypeCode: d.inspectionTypeCode,
        deadlineAnchor: "none",
        intervalValue: null,
        intervalUnit: null,
        cadenceLabel: null,
        constancyObjectCode: d.constancyObjectCode ?? null,
        basisText: d.grund,
        confidence: "not_applicable",
        applicable: false,
        notApplicableReason: d.hinweis,
        referenceDate: args.referenceDate,
        dueAt: null,
        title: d.titel,
        evidenceHint: d.nachweis,
        category: d.category ?? "inspection",
        setsBaseline: d.setsBaseline ?? false,
        requiresBaseline: d.requiresBaseline ?? false,
        referenceDeviceId: d.referenceDeviceId ?? null,
      },
    });
    return;
  }

  const intervalUnit = toIntervalUnit(d.einheit);
  const dueBase =
    d.id === "wartung" && args.lastMaintainedAt ? args.lastMaintainedAt : args.referenceDate;
  const anchor =
    d.deadlineAnchor === "reference" || d.deadlineAnchor === "none"
      ? d.deadlineAnchor
      : d.deadlineAnchor;

  await tx.deviceDuty.create({
    data: {
      tenantId: args.tenantId,
      deviceInstanceId: args.deviceInstanceId,
      snapshotId: args.snapshotId,
      dutyKey,
      inspectionTypeCode: d.inspectionTypeCode,
      deadlineAnchor: anchor as
        | "exact_day"
        | "month_end"
        | "year_end"
        | "event"
        | "interval"
        | "process"
        | "permanent"
        | "reference"
        | "none",
      intervalValue: d.frist,
      intervalUnit,
      cadenceLabel: d.intervall ?? null,
      constancyObjectCode: d.constancyObjectCode ?? null,
      basisText: d.grund,
      confidence: mapConfidence(d.vertrauen, true) as
        | "verified"
        | "responsible"
        | "determination"
        | "derived"
        | "not_applicable",
      applicable: true,
      notApplicableReason: null,
      referenceDate: args.referenceDate,
      dueAt:
        anchor === "reference" || anchor === "none"
          ? null
          : computeDutyDueAt({
              deadlineAnchor: d.deadlineAnchor,
              referenceDate: dueBase,
              intervalValue: d.frist,
              intervalUnit,
            }),
      title: d.titel,
      evidenceHint: d.nachweis,
      category: d.category ?? "inspection",
      setsBaseline: d.setsBaseline ?? false,
      requiresBaseline: d.requiresBaseline ?? false,
      referenceDeviceId: d.referenceDeviceId ?? null,
    },
  });
}
