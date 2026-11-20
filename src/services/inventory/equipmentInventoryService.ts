/**
 * E86 / R31 — non-medical Betriebsmittel create path (flag-gated).
 * Never calls MP deriveDuties / release criteria / book.
 */
import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { isRadiationDguvEnabled, requireRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import type { CreateEquipmentInput } from "@/schemas/radiationDguv";
import { toDeviceInstanceDTO } from "@/services/shared/mappers";

const RULE_SET_ID = "rs-mpbetreibv";

async function requireFlag(ctx: TenantWorkContext) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  requireRadiationDguvEnabled(tenant?.featureFlags);
}

export const equipmentInventoryService = {
  async create(ctx: TenantWorkContext, input: CreateEquipmentInput) {
    requirePermission(ctx, "inventory:update");
    await requireFlag(ctx);

    const area = await prisma.area.findFirst({ where: { id: input.areaId } });
    if (!area) throw notFound("Area not found");

    let inventoryNumber = input.inventoryNumber?.trim() || null;
    if (!inventoryNumber) {
      const count = await prisma.deviceInstance.count({
        where: { tenantId: ctx.tenantId, kind: "equipment" },
      });
      inventoryNumber = `BM-${String(count + 1).padStart(4, "0")}`;
    }

    const dup = await prisma.deviceInstance.findFirst({
      where: { tenantId: ctx.tenantId, inventoryNumber },
    });
    if (dup) throw conflict(`Inventory number ${inventoryNumber} already exists`);

    const actor = actorFromContext(ctx);
    const now = new Date();

    const device = await prisma.$transaction(async (tx) => {
      const created = await tx.deviceInstance.create({
        data: {
          tenantId: ctx.tenantId,
          inventoryNumber,
          serialNumber: input.serialNumber?.trim() || null,
          modelId: null,
          areaId: input.areaId,
          room: input.room?.trim() || null,
          responsiblePerson: input.responsiblePerson.trim(),
          responsibleUserId: input.responsibleUserId ?? null,
          state: "released",
          kind: "equipment",
          productKindCode: "betriebsmittel",
          protectionClass: input.protectionClass,
          portable: input.portable,
          electrical: input.electrical,
          source: "manual",
          createdByUserId: ctx.user.id,
          characteristicsJson: JSON.stringify({
            tradeName: input.label.trim(),
            manufacturer: input.manufacturer?.trim() || null,
            modelName: input.modelName?.trim() || null,
            year: input.year ?? null,
          }),
        },
      });

      const snap = await tx.deviceReleaseSnapshot.create({
        data: {
          tenantId: ctx.tenantId,
          deviceInstanceId: created.id,
          releasedAt: now,
          releasedBy: actor.actorName || actor.actorUserId || "system",
          ruleSetIds: JSON.stringify([RULE_SET_ID]),
          characteristics: JSON.stringify({ kind: "equipment" }),
          derivedDuties: JSON.stringify([{ id: "dguv" }]),
          prerequisites: JSON.stringify([]),
          appVersion: "radiation-dguv",
        },
      });

      await tx.deviceDuty.create({
        data: {
          tenantId: ctx.tenantId,
          deviceInstanceId: created.id,
          snapshotId: snap.id,
          dutyKey: "dguv",
          inspectionTypeCode: "DGUV",
          deadlineAnchor: "interval",
          basisText:
            "ArbSchG · BetrSichV · DGUV Vorschrift 3 — Intervall aus der Gefährdungsbeurteilung festzulegen",
          confidence: "determination",
          applicable: true,
          referenceDate: now,
          dueAt: null,
          title: "Electrical equipment inspection (DGUV V3)",
          category: "inspection",
          determinationState: null,
        },
      });

      await tx.deviceUnitEvent.create({
        data: {
          tenantId: ctx.tenantId,
          deviceInstanceId: created.id,
          actor: actor.actorName || actor.actorUserId || "system",
          action: "equipment_created",
          note: `Betriebsmittel ${inventoryNumber}`,
        },
      });

      return created;
    });

    await recordAudit({
      actor,
      resource: "DeviceInstance",
      resourceId: device.id,
      action: "create_equipment",
      summary: `Betriebsmittel ${inventoryNumber}`,
    });

    const full = await prisma.deviceInstance.findFirst({
      where: { id: device.id },
      include: {
        model: {
          include: {
            classifications: { where: { validTo: null }, take: 1, orderBy: { validFrom: "desc" as const } },
          },
        },
        area: { include: { site: true } },
        responsibleUser: { select: { id: true, name: true, email: true } },
        importJob: { select: { id: true, fileName: true, createdAt: true } },
      },
    });
    if (!full) throw unprocessable("Equipment created but could not be reloaded");
    return toDeviceInstanceDTO(full);
  },

  async isEnabled(ctx: TenantWorkContext): Promise<boolean> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { featureFlags: true },
    });
    return isRadiationDguvEnabled(tenant?.featureFlags);
  },
};
