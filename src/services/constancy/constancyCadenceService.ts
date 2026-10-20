import type {
  ConstancyCadenceDTO,
  MissingConstancyCadenceDTO,
  TenantContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { actorAttribution } from "@/lib/auth/attribution";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { konstanzDueAtFromCadence } from "@/services/k10/k10HardRules";
import { computeDutyDueAt } from "@/services/registration/dueDate";
import type { CreateConstancyCadenceInput } from "@/schemas/k10";

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function deviceLabel(model?: {
  tradeName: string | null;
  modelName: string | null;
} | null): string | null {
  if (!model) return null;
  return model.tradeName || model.modelName || null;
}

const deviceSelect = {
  inventoryNumber: true,
  model: { select: { tradeName: true, modelName: true } },
} as const;

function mapCadence(row: {
  id: string;
  deviceInstanceId: string;
  constancyObjectCode: string;
  intervalValue: number;
  intervalUnit: string;
  basisText: string;
  determinedBy: string;
  determinedAt: Date;
  validFrom: Date;
  validTo: Date | null;
  deviceInstance: {
    inventoryNumber: string;
    model?: { tradeName: string | null; modelName: string | null } | null;
  };
  constancyObject: { label: string | null };
}): ConstancyCadenceDTO {
  return {
    id: row.id,
    deviceInstanceId: row.deviceInstanceId,
    inventoryNumber: row.deviceInstance.inventoryNumber,
    deviceLabel: deviceLabel(row.deviceInstance.model),
    constancyObjectCode: row.constancyObjectCode,
    constancyObjectLabel: row.constancyObject.label,
    intervalValue: row.intervalValue,
    intervalUnit: row.intervalUnit,
    basisText: row.basisText,
    determinedBy: row.determinedBy,
    determinedAt: isoDate(row.determinedAt)!,
    validFrom: row.validFrom.toISOString(),
    validTo: row.validTo?.toISOString() ?? null,
  };
}

function openKey(deviceInstanceId: string, constancyObjectCode: string): string {
  return `${deviceInstanceId}:${constancyObjectCode}`;
}

async function applyDueAtFromCadence(
  deviceInstanceId: string,
  constancyObjectCode: string,
  intervalValue: number,
  intervalUnit: "months" | "years",
  determinedAt: Date,
) {
  const duties = await prisma.deviceDuty.findMany({
    where: {
      deviceInstanceId,
      dutyKey: "konstanz",
      constancyObjectCode,
      applicable: true,
      suspendedAt: null,
    },
  });
  for (const duty of duties) {
    const dueAt = konstanzDueAtFromCadence(
      { intervalValue, intervalUnit, determinedAt },
      computeDutyDueAt,
    );
    await prisma.deviceDuty.update({
      where: { id: duty.id },
      data: {
        intervalValue,
        intervalUnit,
        dueAt,
        cadenceLabel: `${intervalValue} ${intervalUnit}`,
      },
    });
  }
}

export const constancyCadenceService = {
  async listOpen(ctx: TenantContext): Promise<ConstancyCadenceDTO[]> {
    requirePermission(ctx, "duties:view");
    const rows = await prisma.constancyCadence.findMany({
      where: { validTo: null },
      include: {
        deviceInstance: { select: deviceSelect },
        constancyObject: { select: { label: true } },
      },
      orderBy: { determinedAt: "desc" },
      take: 200,
    });
    return rows.map(mapCadence);
  },

  async listMissing(ctx: TenantContext): Promise<MissingConstancyCadenceDTO[]> {
    requirePermission(ctx, "duties:view");
    const duties = await prisma.deviceDuty.findMany({
      where: {
        dutyKey: "konstanz",
        applicable: true,
        suspendedAt: null,
        constancyObjectCode: { not: null },
      },
      include: {
        deviceInstance: { select: deviceSelect },
        constancyObject: { select: { label: true, defaultCadence: true } },
      },
      take: 500,
    });
    const open = await prisma.constancyCadence.findMany({
      where: { validTo: null },
      select: { deviceInstanceId: true, constancyObjectCode: true },
    });
    const openSet = new Set(open.map((o) => openKey(o.deviceInstanceId, o.constancyObjectCode)));
    return duties
      .filter((d) => d.constancyObjectCode && !openSet.has(openKey(d.deviceInstanceId, d.constancyObjectCode)))
      .map((d) => ({
        deviceInstanceId: d.deviceInstanceId,
        inventoryNumber: d.deviceInstance.inventoryNumber,
        deviceLabel: deviceLabel(d.deviceInstance.model),
        constancyObjectCode: d.constancyObjectCode!,
        constancyObjectLabel: d.constancyObject?.label ?? null,
        defaultCadence: d.constancyObject?.defaultCadence ?? null,
        dutyId: d.id,
      }));
  },

  async determine(ctx: TenantContext, input: CreateConstancyCadenceInput): Promise<ConstancyCadenceDTO> {
    requirePermission(ctx, "duties:view");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: input.deviceInstanceId },
      select: { id: true },
    });
    if (!device) throw notFound("Device not found");
    const obj = await prisma.refConstancyObject.findUnique({ where: { code: input.constancyObjectCode } });
    if (!obj) throw badRequest("Unknown constancy object");

    const key = openKey(input.deviceInstanceId, input.constancyObjectCode);
    await prisma.constancyCadence.updateMany({
      where: {
        deviceInstanceId: input.deviceInstanceId,
        constancyObjectCode: input.constancyObjectCode,
        validTo: null,
      },
      data: { validTo: new Date(), openCadenceKey: null },
    });

    const determinedAt = new Date(`${input.determinedAt}T00:00:00.000Z`);
    const determiner = actorAttribution(ctx);
    const row = await prisma.constancyCadence.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId: input.deviceInstanceId,
        constancyObjectCode: input.constancyObjectCode,
        intervalValue: input.intervalValue,
        intervalUnit: input.intervalUnit,
        basisText: input.basisText,
        determinedBy: determiner.name,
        determinedByUserId: determiner.userId,
        determinedAt,
        openCadenceKey: key,
      },
      include: {
        deviceInstance: { select: deviceSelect },
        constancyObject: { select: { label: true } },
      },
    });

    await applyDueAtFromCadence(
      input.deviceInstanceId,
      input.constancyObjectCode,
      input.intervalValue,
      input.intervalUnit,
      determinedAt,
    );

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "ConstancyCadence",
      resourceId: row.id,
      action: "determine",
      summary: `Cadence ${input.intervalValue} ${input.intervalUnit} for ${input.constancyObjectCode}`,
    });

    return mapCadence(row);
  },
};
