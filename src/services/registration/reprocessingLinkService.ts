import type { TenantWorkContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export interface LinkReprocessingInput {
  profileDeviceId: string;
  equipmentDeviceId: string;
}

/** Equipment must be a reprocessing device exemplar (product kind or Merkmale). */
export function isReprocessingEquipmentDevice(device: {
  productKindCode: string | null;
  characteristicsJson: string | null;
}): boolean {
  if (device.productKindCode === "aufbereitungsgeraet") return true;
  if (!device.characteristicsJson) return false;
  try {
    const c = JSON.parse(device.characteristicsJson) as {
      istAufbGeraet?: boolean;
      eigenTyp?: string | null;
    };
    return Boolean(c.istAufbGeraet && c.eigenTyp);
  } catch {
    return false;
  }
}

export function reprocessingOpenLinkKey(profileDeviceId: string, equipmentDeviceId: string): string {
  return `${profileDeviceId}:${equipmentDeviceId}`;
}

/**
 * AUF-01 — link a reprocessed product exemplar to equipment exemplars.
 * Rejects outsourced profiles that already claim external reprocessing.
 * Links are historised (validFrom/validTo); unlink closes the open row.
 */
export const reprocessingLinkService = {
  async listForProduct(ctx: TenantWorkContext, profileDeviceId: string) {
    requirePermission(ctx, "inventory:view");
    const rows = await prisma.reprocessingOnDevice.findMany({
      where: { tenantId: ctx.tenantId, profileDeviceId, validTo: null },
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
      validFrom: r.validFrom.toISOString(),
      validTo: r.validTo?.toISOString() ?? null,
      recordedBy: r.recordedBy,
      recordedAt: r.recordedAt.toISOString(),
    }));
  },

  async listForEquipment(ctx: TenantWorkContext, equipmentDeviceId: string) {
    requirePermission(ctx, "inventory:view");
    const rows = await prisma.reprocessingOnDevice.findMany({
      where: { tenantId: ctx.tenantId, equipmentDeviceId, validTo: null },
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
      validFrom: r.validFrom.toISOString(),
      validTo: r.validTo?.toISOString() ?? null,
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
        select: {
          id: true,
          productKindCode: true,
          characteristicsJson: true,
        },
      }),
    ]);
    if (!profile) throw notFound("Product device not found.");
    if (!equipment) throw notFound("Equipment device not found.");
    if (profile.id === equipment.id) {
      throw unprocessable("Product and equipment must be different instances.");
    }
    if (!isReprocessingEquipmentDevice(equipment)) {
      throw unprocessable(
        "Linked device must be reprocessing equipment (product kind or istAufbGeraet + eigenTyp).",
        { field: "equipmentDeviceId" },
      );
    }
    if (profile.reprocessingProfile?.outsourced) {
      throw unprocessable(
        "Cannot link in-house reprocessing equipment while the product profile is marked outsourced.",
        { field: "outsourced" },
      );
    }

    const open = await prisma.reprocessingOnDevice.findFirst({
      where: {
        tenantId: ctx.tenantId,
        profileDeviceId: profile.id,
        equipmentDeviceId: equipment.id,
        validTo: null,
      },
    });
    if (open) {
      const row = await prisma.reprocessingOnDevice.update({
        where: { id: open.id },
        data: {
          recordedBy: ctx.user.name,
          recordedAt: new Date(),
          openLinkKey: reprocessingOpenLinkKey(profile.id, equipment.id),
        },
      });
      return { id: row.id, profileDeviceId: row.profileDeviceId, equipmentDeviceId: row.equipmentDeviceId };
    }

    const row = await prisma.reprocessingOnDevice.create({
      data: {
        tenantId: ctx.tenantId,
        profileDeviceId: profile.id,
        equipmentDeviceId: equipment.id,
        recordedBy: ctx.user.name,
        validFrom: new Date(),
        openLinkKey: reprocessingOpenLinkKey(profile.id, equipment.id),
      },
    });
    return { id: row.id, profileDeviceId: row.profileDeviceId, equipmentDeviceId: row.equipmentDeviceId };
  },

  async unlink(ctx: TenantWorkContext, id: string) {
    requirePermission(ctx, "inventory:update");
    const row = await prisma.reprocessingOnDevice.findFirst({
      where: { id, tenantId: ctx.tenantId, validTo: null },
    });
    if (!row) throw notFound("Link not found.");
    await prisma.reprocessingOnDevice.update({
      where: { id },
      data: { validTo: new Date(), openLinkKey: null },
    });
    return { ok: true as const };
  },

  /**
   * Derived validation status for a product — from linked equipment validation duties.
   * No stored duplicate truth.
   */
  async productValidationStatus(ctx: TenantWorkContext, profileDeviceId: string) {
    requirePermission(ctx, "inventory:view");
    const links = await prisma.reprocessingOnDevice.findMany({
      where: { tenantId: ctx.tenantId, profileDeviceId, validTo: null },
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
