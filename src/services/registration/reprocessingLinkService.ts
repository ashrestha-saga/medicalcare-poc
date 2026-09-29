import type { TenantWorkContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export interface LinkReprocessingInput {
  profileDeviceId: string;
  equipmentDeviceId: string;
}

/**
 * AUF-01 — link a reprocessed product exemplar to equipment exemplars.
 * Rejects outsourced profiles that already claim external reprocessing.
 */
export const reprocessingLinkService = {
  async listForProduct(ctx: TenantWorkContext, profileDeviceId: string) {
    requirePermission(ctx, "inventory:view");
    const rows = await prisma.reprocessingOnDevice.findMany({
      where: { tenantId: ctx.tenantId, profileDeviceId },
      include: {
        equipmentDevice: {
          select: { id: true, inventoryNumber: true, productKindCode: true },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      profileDeviceId: r.profileDeviceId,
      equipmentDeviceId: r.equipmentDeviceId,
      equipmentInventoryNumber: r.equipmentDevice.inventoryNumber,
      recordedBy: r.recordedBy,
      recordedAt: r.recordedAt.toISOString(),
    }));
  },

  async listForEquipment(ctx: TenantWorkContext, equipmentDeviceId: string) {
    requirePermission(ctx, "inventory:view");
    const rows = await prisma.reprocessingOnDevice.findMany({
      where: { tenantId: ctx.tenantId, equipmentDeviceId },
      include: {
        profileDevice: {
          select: { id: true, inventoryNumber: true, productKindCode: true },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      profileDeviceId: r.profileDeviceId,
      equipmentDeviceId: r.equipmentDeviceId,
      productInventoryNumber: r.profileDevice.inventoryNumber,
      recordedBy: r.recordedBy,
      recordedAt: r.recordedAt.toISOString(),
    }));
  },

  async link(ctx: TenantWorkContext, input: LinkReprocessingInput) {
    requirePermission(ctx, "inventory:update");
    const [profile, equipment] = await Promise.all([
      prisma.deviceInstance.findFirst({
        where: { id: input.profileDeviceId, tenantId: ctx.tenantId },
        include: { reprocessingProfile: true },
      }),
      prisma.deviceInstance.findFirst({
        where: { id: input.equipmentDeviceId, tenantId: ctx.tenantId },
      }),
    ]);
    if (!profile) throw notFound("Product device not found.");
    if (!equipment) throw notFound("Equipment device not found.");
    if (profile.id === equipment.id) {
      throw unprocessable("Product and equipment must be different instances.");
    }
    if (profile.reprocessingProfile?.outsourced) {
      throw unprocessable(
        "Cannot link in-house reprocessing equipment while the product profile is marked outsourced.",
        { field: "outsourced" },
      );
    }

    const row = await prisma.reprocessingOnDevice.upsert({
      where: {
        profileDeviceId_equipmentDeviceId: {
          profileDeviceId: profile.id,
          equipmentDeviceId: equipment.id,
        },
      },
      update: { recordedBy: ctx.user.name, recordedAt: new Date() },
      create: {
        tenantId: ctx.tenantId,
        profileDeviceId: profile.id,
        equipmentDeviceId: equipment.id,
        recordedBy: ctx.user.name,
      },
    });
    return { id: row.id, profileDeviceId: row.profileDeviceId, equipmentDeviceId: row.equipmentDeviceId };
  },

  async unlink(ctx: TenantWorkContext, id: string) {
    requirePermission(ctx, "inventory:update");
    const row = await prisma.reprocessingOnDevice.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!row) throw notFound("Link not found.");
    await prisma.reprocessingOnDevice.delete({ where: { id } });
    return { ok: true as const };
  },

  /**
   * Derived validation status for a product — from linked equipment validation duties.
   * No stored duplicate truth.
   */
  async productValidationStatus(ctx: TenantWorkContext, profileDeviceId: string) {
    requirePermission(ctx, "inventory:view");
    const links = await prisma.reprocessingOnDevice.findMany({
      where: { tenantId: ctx.tenantId, profileDeviceId },
    });
    if (!links.length) {
      return { linked: false, equipment: [] as { deviceId: string; dueAt: string | null; lastCompletedAt: string | null }[] };
    }
    const equipmentIds = links.map((l) => l.equipmentDeviceId);
    const duties = await prisma.deviceDuty.findMany({
      where: {
        tenantId: ctx.tenantId,
        deviceInstanceId: { in: equipmentIds },
        inspectionTypeCode: "VALIDATION",
        applicable: true,
        suspendedAt: null,
      },
      select: {
        deviceInstanceId: true,
        dueAt: true,
        lastCompletedAt: true,
      },
    });
    return {
      linked: true,
      equipment: duties.map((d) => ({
        deviceId: d.deviceInstanceId,
        dueAt: d.dueAt?.toISOString().slice(0, 10) ?? null,
        lastCompletedAt: d.lastCompletedAt?.toISOString() ?? null,
      })),
    };
  },
};
