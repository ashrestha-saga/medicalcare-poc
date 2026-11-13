import type { TenantContext } from "@/interfaces";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { isRepairsEnabled } from "@/lib/features/repairs";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { transitionOperationalState } from "@/services/repairs/operationalStateService";

async function assertRepairs(ctx: TenantContext) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  if (!isRepairsEnabled(tenant?.featureFlags)) {
    throw forbidden("Repairs feature is not enabled for this tenant");
  }
}

/** R14 — link an existing instance as loaner, or create a loaner instance. */
export async function assignReplacement(
  ctx: TenantContext,
  defectiveId: string,
  input: {
    instanceId?: string;
    create?: {
      inventoryNumber: string;
      serialNumber?: string | null;
      modelId?: string | null;
      loanerLender: string;
      areaId?: string | null;
      room?: string | null;
    };
  },
) {
  requirePermission(ctx, "inventory:update");
  await assertRepairs(ctx);

  const defective = await prisma.deviceInstance.findFirst({ where: { id: defectiveId } });
  if (!defective) throw notFound("Device not found");

  let loanerId = input.instanceId ?? null;

  if (!loanerId && input.create) {
    if (!input.create.inventoryNumber.trim() || !input.create.loanerLender.trim()) {
      throw unprocessable("inventoryNumber and loanerLender required to create a loaner");
    }
    const created = await prisma.deviceInstance.create({
      data: {
        tenantId: ctx.tenantId,
        inventoryNumber: input.create.inventoryNumber.trim(),
        serialNumber: input.create.serialNumber?.trim() || null,
        modelId: input.create.modelId ?? defective.modelId,
        areaId: input.create.areaId ?? defective.areaId,
        room: input.create.room ?? defective.room,
        state: "released",
        source: "external",
        operationalState: "loaner",
        loanerLender: input.create.loanerLender.trim(),
        createdByUserId: ctx.user.id,
      },
    });
    loanerId = created.id;
  }

  if (!loanerId) throw unprocessable("instanceId or create payload required");

  const loaner = await prisma.deviceInstance.findFirst({ where: { id: loanerId } });
  if (!loaner) throw notFound("Loaner device not found");

  await prisma.$transaction(async (tx) => {
    await tx.deviceInstance.update({
      where: { id: defective.id },
      data: { replacedById: loaner.id },
    });
    await transitionOperationalState(ctx, {
      deviceInstanceId: defective.id,
      to: "replaced",
      note: `Loaner ${loaner.inventoryNumber}`,
      tx,
    });
    if (loaner.operationalState !== "loaner") {
      await transitionOperationalState(ctx, {
        deviceInstanceId: loaner.id,
        to: "loaner",
        note: `For ${defective.inventoryNumber}`,
        tx,
      });
      await tx.deviceInstance.update({
        where: { id: loaner.id },
        data: {
          loanerLender: input.create?.loanerLender?.trim() || loaner.loanerLender,
        },
      });
    }
    await tx.deviceClarification.create({
      data: {
        tenantId: ctx.tenantId,
        deviceInstanceId: loaner.id,
        kind: "loaner_instruction",
        label: `Einweisung Leihgerät ${loaner.inventoryNumber}`,
        deferredBy: ctx.user.name,
        deferredAt: new Date(),
      },
    });
  });

  await recordAudit({
    actor: actorFromTenant(ctx),
    resource: "DeviceInstance",
    resourceId: defective.id,
    action: "assign_replacement",
    summary: `Loaner ${loaner.inventoryNumber} for ${defective.inventoryNumber}`,
    after: { replacedById: loaner.id },
  });

  return { defectiveId: defective.id, loanerId: loaner.id };
}
