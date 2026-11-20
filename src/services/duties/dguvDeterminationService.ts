/**
 * E85 / R32 — DGUV determination (own_check | covered_by_stk | not_applicable).
 * STK-covers-DGUV suspension lives on DeviceDuty (no DutyOverlapDecision).
 */
import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { requireRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { computeDguvDeterminationDutyPatch } from "@/services/duties/dguvDeterminationFields";
import { recomputeDutyProjection } from "@/services/duties/dutyProjection";
import type { DguvDeterminationInput } from "@/schemas/radiationDguv";

async function requireFlag(ctx: TenantWorkContext) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  requireRadiationDguvEnabled(tenant?.featureFlags);
}

export type DguvDeterminationResult = {
  deviceInstanceId: string;
  dutyId: string;
  determinationState: string;
  dueAt: string | null;
  intervalMonths: number | null;
};

export const dguvDeterminationService = {
  async determine(
    ctx: TenantWorkContext,
    deviceInstanceId: string,
    input: DguvDeterminationInput,
  ): Promise<DguvDeterminationResult> {
    requirePermission(ctx, "duties:view");
    await requireFlag(ctx);

    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceInstanceId },
    });
    if (!device) throw notFound("Device not found");

    // Include covered_by_stk (suspended) so operators can switch Festlegung away.
    const duty = await prisma.deviceDuty.findFirst({
      where: {
        deviceInstanceId,
        dutyKey: "dguv",
        OR: [{ suspendedAt: null }, { determinationState: "covered_by_stk" }],
      },
      orderBy: { referenceDate: "desc" },
    });
    if (!duty) throw unprocessable("No DGUV duty on this device");

    if (input.state === "covered_by_stk") {
      if (device.kind === "equipment") {
        throw unprocessable("covered_by_stk is not allowed for Betriebsmittel", {
          field: "state",
        });
      }
      const stk = await prisma.deviceDuty.findFirst({
        where: {
          deviceInstanceId,
          dutyKey: "stk",
          applicable: true,
          suspendedAt: null,
        },
      });
      if (!stk) {
        throw unprocessable("covered_by_stk requires an applicable STK duty (Anlage-1)", {
          field: "state",
        });
      }
    }

    if (input.state === "not_applicable" && device.electrical !== false) {
      throw unprocessable("not_applicable only when the device is non-electrical", {
        field: "state",
      });
    }

    const actor = actorFromContext(ctx);
    const now = new Date();
    const decidedAt = now;
    const patch = computeDguvDeterminationDutyPatch({
      state: input.state,
      intervalMonths: input.intervalMonths,
      reason: input.reason,
      gbuRef: input.gbuRef,
      lastCompletedAt: duty.lastCompletedAt,
      now,
    });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.deviceDuty.update({
        where: { id: duty.id },
        data: {
          determinationState: input.state,
          determinedBy: actor.actorName || ctx.user.id,
          determinedByUserId: ctx.user.id,
          determinedAt: decidedAt,
          basisText: input.gbuRef,
          intervalValue: patch.intervalValue,
          intervalUnit: patch.intervalUnit,
          // "interval" means TBD until Festlegung; once months are set, exact_day
          // lets computeDutyDueAt advance dueAt after own checks / partner runs.
          deadlineAnchor:
            input.state === "own_check" && patch.intervalValue != null
              ? "exact_day"
              : duty.deadlineAnchor,
          applicable: patch.applicable,
          notApplicableReason: patch.notApplicableReason,
          dueAt: patch.dueAt,
          suspendedAt: patch.suspendedAt,
        },
      });

      await recomputeDutyProjection(tx, deviceInstanceId, now);

      return updated;
    });

    await recordAudit({
      actor,
      resource: "DeviceDuty",
      resourceId: result.id,
      action: "dguv_determination",
      summary: `${input.state} · ${input.gbuRef}`,
    });

    return {
      deviceInstanceId,
      dutyId: result.id,
      determinationState: result.determinationState ?? input.state,
      dueAt: result.dueAt?.toISOString() ?? null,
      intervalMonths: result.intervalValue,
    };
  },

  async determineBatch(
    ctx: TenantWorkContext,
    deviceIds: string[],
    input: DguvDeterminationInput,
  ): Promise<{ results: DguvDeterminationResult[]; errors: Array<{ deviceId: string; message: string }> }> {
    const results: DguvDeterminationResult[] = [];
    const errors: Array<{ deviceId: string; message: string }> = [];
    for (const id of deviceIds) {
      try {
        results.push(await this.determine(ctx, id, input));
      } catch (e) {
        errors.push({
          deviceId: id,
          message: e instanceof Error ? e.message : "failed",
        });
      }
    }
    return { results, errors };
  },

  /** Devices with DGUV duty and determinationState null (flag-on tile semantics). */
  async listWithoutDetermination(ctx: TenantWorkContext) {
    requirePermission(ctx, "duties:view");
    await requireFlag(ctx);
    const duties = await prisma.deviceDuty.findMany({
      where: {
        dutyKey: "dguv",
        applicable: true,
        suspendedAt: null,
        determinationState: null,
      },
      select: {
        id: true,
        deviceInstanceId: true,
        deviceInstance: {
          select: {
            id: true,
            inventoryNumber: true,
            kind: true,
            model: { select: { tradeName: true, modelName: true } },
            characteristicsJson: true,
          },
        },
      },
      take: 500,
    });
    return duties.map((d) => ({
      dutyId: d.id,
      deviceInstanceId: d.deviceInstanceId,
      inventoryNumber: d.deviceInstance.inventoryNumber,
      kind: d.deviceInstance.kind,
      tradeName:
        d.deviceInstance.model?.tradeName ??
        (() => {
          try {
            const j = d.deviceInstance.characteristicsJson
              ? JSON.parse(d.deviceInstance.characteristicsJson)
              : null;
            return typeof j?.tradeName === "string" ? j.tradeName : null;
          } catch {
            return null;
          }
        })(),
    }));
  },
};
