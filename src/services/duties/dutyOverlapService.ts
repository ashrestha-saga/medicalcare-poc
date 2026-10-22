import type { DutyOverlapDecisionDTO, TenantContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import type { CreateDutyOverlapInput } from "@/schemas/k10";
import { recomputeDutyProjection } from "@/services/duties/dutyProjection";
import { isOverlapSuspensionReason } from "@/services/duties/overlapProjection";
import type { DutyKey } from "@prisma/client";

export type OverlapCandidateDevice = {
  id: string;
  inventoryNumber: string;
  tradeName: string | null;
  modelName: string | null;
};

/** Current-generation duty: live, or suspended only by an overlap decision. */
function isCurrentDutyRow(d: {
  suspendedAt: Date | null;
  notApplicableReason: string | null;
}): boolean {
  return d.suspendedAt == null || isOverlapSuspensionReason(d.notApplicableReason);
}

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function mapDecision(row: {
  id: string;
  deviceInstanceId: string;
  coveredDutyKey: string;
  satisfiedByDutyKey: string;
  reasonText: string;
  decidedBy: string;
  decidedAt: Date;
  validTo: Date | null;
  deviceInstance: { inventoryNumber: string };
}): DutyOverlapDecisionDTO {
  return {
    id: row.id,
    deviceInstanceId: row.deviceInstanceId,
    inventoryNumber: row.deviceInstance.inventoryNumber,
    coveredDutyKey: row.coveredDutyKey,
    satisfiedByDutyKey: row.satisfiedByDutyKey,
    reasonText: row.reasonText,
    decidedBy: row.decidedBy,
    decidedAt: isoDate(row.decidedAt)!,
    validTo: row.validTo?.toISOString() ?? null,
  };
}

export const dutyOverlapService = {
  async list(ctx: TenantContext): Promise<DutyOverlapDecisionDTO[]> {
    requirePermission(ctx, "duties:view");
    const rows = await prisma.dutyOverlapDecision.findMany({
      where: { validTo: null },
      include: { deviceInstance: { select: { inventoryNumber: true } } },
      orderBy: { decidedAt: "desc" },
      take: 500,
    });
    return rows.map(mapDecision);
  },

  /**
   * Released devices that currently carry both STK and DGUV duties
   * (the only pairs the overlap UI records).
   */
  async listCandidateDevices(ctx: TenantContext): Promise<OverlapCandidateDevice[]> {
    requirePermission(ctx, "duties:view");
    const duties = await prisma.deviceDuty.findMany({
      where: {
        dutyKey: { in: ["stk", "dguv"] },
      },
      select: {
        deviceInstanceId: true,
        dutyKey: true,
        suspendedAt: true,
        notApplicableReason: true,
        deviceInstance: {
          select: {
            id: true,
            state: true,
            inventoryNumber: true,
            model: { select: { tradeName: true, modelName: true } },
          },
        },
      },
    });

    const byDevice = new Map<string, { stk: boolean; dguv: boolean; row: (typeof duties)[0] }>();
    for (const d of duties) {
      if (d.deviceInstance.state !== "released") continue;
      if (!isCurrentDutyRow(d)) continue;
      const entry = byDevice.get(d.deviceInstanceId) ?? {
        stk: false,
        dguv: false,
        row: d,
      };
      if (d.dutyKey === "stk") entry.stk = true;
      if (d.dutyKey === "dguv") entry.dguv = true;
      byDevice.set(d.deviceInstanceId, entry);
    }

    return [...byDevice.values()]
      .filter((e) => e.stk && e.dguv)
      .map((e) => ({
        id: e.row.deviceInstance.id,
        inventoryNumber: e.row.deviceInstance.inventoryNumber,
        tradeName: e.row.deviceInstance.model?.tradeName ?? null,
        modelName: e.row.deviceInstance.model?.modelName ?? null,
      }))
      .sort((a, b) => a.inventoryNumber.localeCompare(b.inventoryNumber));
  },

  async decide(ctx: TenantContext, input: CreateDutyOverlapInput): Promise<DutyOverlapDecisionDTO> {
    requirePermission(ctx, "duties:view");
    if (input.coveredDutyKey === input.satisfiedByDutyKey) {
      throw badRequest("coveredDutyKey and satisfiedByDutyKey must differ");
    }
    const device = await prisma.deviceInstance.findFirst({ where: { id: input.deviceInstanceId } });
    if (!device) throw notFound("Device not found");

    const coveredKey = input.coveredDutyKey as DutyKey;
    const coveredCount = await prisma.deviceDuty.count({
      where: {
        deviceInstanceId: input.deviceInstanceId,
        dutyKey: coveredKey,
      },
    });
    if (coveredCount === 0) {
      throw badRequest(`No ${input.coveredDutyKey} duty on this device`);
    }

    const key = `${input.deviceInstanceId}:${input.coveredDutyKey}:${input.satisfiedByDutyKey}`;
    const decidedAt = new Date(`${input.decidedAt}T00:00:00.000Z`);
    const now = new Date();

    const row = await prisma.$transaction(async (tx) => {
      await tx.dutyOverlapDecision.updateMany({
        where: {
          deviceInstanceId: input.deviceInstanceId,
          coveredDutyKey: input.coveredDutyKey,
          satisfiedByDutyKey: input.satisfiedByDutyKey,
          validTo: null,
        },
        data: { validTo: now, openDecisionKey: null },
      });

      const created = await tx.dutyOverlapDecision.create({
        data: {
          tenantId: ctx.tenantId,
          deviceInstanceId: input.deviceInstanceId,
          coveredDutyKey: input.coveredDutyKey,
          satisfiedByDutyKey: input.satisfiedByDutyKey,
          reasonText: input.reasonText,
          decidedBy: ctx.user.id,
          decidedAt,
          openDecisionKey: key,
        },
        include: { deviceInstance: { select: { inventoryNumber: true } } },
      });

      await recomputeDutyProjection(tx, input.deviceInstanceId, now);

      return created;
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "DutyOverlapDecision",
      resourceId: row.id,
      action: "decide",
      summary: `${input.coveredDutyKey} covered by ${input.satisfiedByDutyKey} (covered duty suspended)`,
    });

    return mapDecision(row);
  },

  /**
   * Close an open overlap decision and reactivate the covered duty
   * when no other open decision still covers it.
   */
  async revoke(ctx: TenantContext, decisionId: string): Promise<DutyOverlapDecisionDTO> {
    requirePermission(ctx, "duties:view");
    const existing = await prisma.dutyOverlapDecision.findFirst({
      where: { id: decisionId },
      include: { deviceInstance: { select: { inventoryNumber: true } } },
    });
    if (!existing) throw notFound("Overlap decision not found");
    if (existing.validTo) throw badRequest("Decision already closed");

    const now = new Date();

    const row = await prisma.$transaction(async (tx) => {
      const closed = await tx.dutyOverlapDecision.update({
        where: { id: decisionId },
        data: { validTo: now, openDecisionKey: null },
        include: { deviceInstance: { select: { inventoryNumber: true } } },
      });

      await recomputeDutyProjection(tx, existing.deviceInstanceId, now);

      return closed;
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "DutyOverlapDecision",
      resourceId: row.id,
      action: "revoke",
      summary: `Revoked ${existing.coveredDutyKey} ← ${existing.satisfiedByDutyKey}`,
    });

    return mapDecision(row);
  },
};
