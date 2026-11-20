import type {
  ConstancyCadenceDTO,
  MissingConstancyCadenceDTO,
  TenantWorkContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromContext } from "@/lib/auth/actorContext";
import { actorAttribution } from "@/lib/auth/attribution";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { recomputeDutyProjection } from "@/services/duties/dutyProjection";
import { guidelineCadenceMismatch } from "@/lib/constancy/suggestCadence";
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
  captureMode?: string | null;
  protocolSource?: string | null;
  referenceValuesJson?: unknown;
  deviceInstance: {
    inventoryNumber: string;
    model?: { tradeName: string | null; modelName: string | null } | null;
  };
  constancyObject: { label: string | null };
}): ConstancyCadenceDTO {
  const mode =
    row.captureMode === "manual_measurement" || row.captureMode === "visual"
      ? row.captureMode
      : row.captureMode === "device_protocol"
        ? "device_protocol"
        : "device_protocol";
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
    captureMode: mode,
    protocolSource: row.protocolSource ?? null,
    referenceValuesJson: row.referenceValuesJson ?? null,
  };
}

function openKey(deviceInstanceId: string, constancyObjectCode: string): string {
  return `${deviceInstanceId}:${constancyObjectCode}`;
}

export const constancyCadenceService = {
  async listOpen(ctx: TenantWorkContext): Promise<ConstancyCadenceDTO[]> {
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

  async listMissing(ctx: TenantWorkContext): Promise<MissingConstancyCadenceDTO[]> {
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

  async determine(ctx: TenantWorkContext, input: CreateConstancyCadenceInput): Promise<ConstancyCadenceDTO> {
    requirePermission(ctx, "duties:view");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: input.deviceInstanceId },
      select: { id: true },
    });
    if (!device) throw notFound("Device not found");
    const obj = await prisma.refConstancyObject.findUnique({ where: { code: input.constancyObjectCode } });
    if (!obj) throw badRequest("Unknown constancy object");
    const mismatch = guidelineCadenceMismatch(obj.defaultCadence, input.intervalUnit);
    if (mismatch.mismatch && mismatch.guideline && mismatch.suggestedUnit) {
      throw badRequest(
        `Interval unit does not match QS-RL “${mismatch.guideline}” (use ${mismatch.suggestedUnit}).`,
        { field: "intervalUnit", suggestedUnit: mismatch.suggestedUnit },
      );
    }

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
        captureMode: input.captureMode ?? "device_protocol",
        protocolSource: input.protocolSource?.trim() || null,
        referenceValuesJson: input.referenceValuesJson ?? undefined,
      },
      include: {
        deviceInstance: { select: deviceSelect },
        constancyObject: { select: { label: true } },
      },
    });

    await recomputeDutyProjection(prisma, input.deviceInstanceId);

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "ConstancyCadence",
      resourceId: row.id,
      action: "determine",
      summary: `Cadence ${input.intervalValue} ${input.intervalUnit} for ${input.constancyObjectCode}`,
    });

    return mapCadence(row);
  },
};
