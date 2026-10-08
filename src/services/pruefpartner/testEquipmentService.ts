import type { PartnerContext } from "@/interfaces/session";
import type { TestEquipmentDTO } from "@/interfaces/pruefpartner";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";

function toDto(row: {
  id: string;
  classCode: string;
  label: string;
  serialNumber: string | null;
  calibratedUntil: Date | null;
  traceabilityRef: string | null;
  active: boolean;
}): TestEquipmentDTO {
  return {
    id: row.id,
    classCode: row.classCode,
    label: row.label,
    serialNumber: row.serialNumber,
    calibratedUntil: row.calibratedUntil?.toISOString().slice(0, 10) ?? null,
    traceabilityRef: row.traceabilityRef,
    active: row.active,
  };
}

export const testEquipmentService = {
  async list(ctx: PartnerContext, classCode?: string): Promise<TestEquipmentDTO[]> {
    requirePartnerPermission(ctx, "testequipment:manage", "console:organisation:view");
    const rows = await prisma.testEquipment.findMany({
      where: {
        organisationId: ctx.organisationId,
        ...(classCode ? { classCode } : {}),
      },
      orderBy: [{ classCode: "asc" }, { label: "asc" }],
    });
    return rows.map(toDto);
  },

  async create(
    ctx: PartnerContext,
    input: {
      classCode: string;
      label: string;
      serialNumber?: string | null;
      calibratedUntil?: string | null;
      traceabilityRef?: string | null;
    },
  ): Promise<TestEquipmentDTO> {
    requirePartnerPermission(ctx, "testequipment:manage");
    const row = await prisma.testEquipment.create({
      data: {
        organisationId: ctx.organisationId,
        classCode: input.classCode,
        label: input.label,
        serialNumber: input.serialNumber ?? null,
        calibratedUntil: input.calibratedUntil
          ? new Date(`${input.calibratedUntil}T00:00:00`)
          : null,
        traceabilityRef: input.traceabilityRef ?? null,
      },
    });
    return toDto(row);
  },

  async update(
    ctx: PartnerContext,
    id: string,
    input: Partial<{
      label: string;
      serialNumber: string | null;
      calibratedUntil: string | null;
      traceabilityRef: string | null;
      active: boolean;
    }>,
  ): Promise<TestEquipmentDTO> {
    requirePartnerPermission(ctx, "testequipment:manage");
    const existing = await prisma.testEquipment.findFirst({
      where: { id, organisationId: ctx.organisationId },
    });
    if (!existing) throw notFound("Test equipment not found.");
    const row = await prisma.testEquipment.update({
      where: { id },
      data: {
        ...(input.label != null ? { label: input.label } : {}),
        ...(input.serialNumber !== undefined ? { serialNumber: input.serialNumber } : {}),
        ...(input.calibratedUntil !== undefined
          ? {
              calibratedUntil: input.calibratedUntil
                ? new Date(`${input.calibratedUntil}T00:00:00`)
                : null,
            }
          : {}),
        ...(input.traceabilityRef !== undefined ? { traceabilityRef: input.traceabilityRef } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    return toDto(row);
  },
};
