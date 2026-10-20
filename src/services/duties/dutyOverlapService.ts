import type { DutyOverlapDecisionDTO, TenantContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import type { CreateDutyOverlapInput } from "@/schemas/k10";

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
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
    return rows.map((r) => ({
      id: r.id,
      deviceInstanceId: r.deviceInstanceId,
      inventoryNumber: r.deviceInstance.inventoryNumber,
      coveredDutyKey: r.coveredDutyKey,
      satisfiedByDutyKey: r.satisfiedByDutyKey,
      reasonText: r.reasonText,
      decidedBy: r.decidedBy,
      decidedAt: isoDate(r.decidedAt)!,
      validTo: r.validTo?.toISOString() ?? null,
    }));
  },

  async decide(ctx: TenantContext, input: CreateDutyOverlapInput): Promise<DutyOverlapDecisionDTO> {
    requirePermission(ctx, "duties:view");
    if (input.coveredDutyKey === input.satisfiedByDutyKey) {
      throw badRequest("coveredDutyKey and satisfiedByDutyKey must differ");
    }
    const device = await prisma.deviceInstance.findFirst({ where: { id: input.deviceInstanceId } });
    if (!device) throw notFound("Device not found");

    const key = `${input.deviceInstanceId}:${input.coveredDutyKey}:${input.satisfiedByDutyKey}`;
    await prisma.dutyOverlapDecision.updateMany({
      where: {
        deviceInstanceId: input.deviceInstanceId,
        coveredDutyKey: input.coveredDutyKey,
        satisfiedByDutyKey: input.satisfiedByDutyKey,
        validTo: null,
      },
      data: { validTo: new Date(), openDecisionKey: null },
    });

    const row = await prisma.dutyOverlapDecision.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId: input.deviceInstanceId,
        coveredDutyKey: input.coveredDutyKey,
        satisfiedByDutyKey: input.satisfiedByDutyKey,
        reasonText: input.reasonText,
        decidedBy: ctx.user.id,
        decidedAt: new Date(`${input.decidedAt}T00:00:00.000Z`),
        openDecisionKey: key,
      },
      include: { deviceInstance: { select: { inventoryNumber: true } } },
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "DutyOverlapDecision",
      resourceId: row.id,
      action: "decide",
      summary: `${input.coveredDutyKey} covered by ${input.satisfiedByDutyKey}`,
    });

    return {
      id: row.id,
      deviceInstanceId: row.deviceInstanceId,
      inventoryNumber: row.deviceInstance.inventoryNumber,
      coveredDutyKey: row.coveredDutyKey,
      satisfiedByDutyKey: row.satisfiedByDutyKey,
      reasonText: row.reasonText,
      decidedBy: row.decidedBy,
      decidedAt: isoDate(row.decidedAt)!,
      validTo: null,
    };
  },
};
