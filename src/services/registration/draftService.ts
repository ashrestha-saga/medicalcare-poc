import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { changedFields, recordAudit } from "@/services/audit/auditService";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { allocateInventoryNumber } from "@/services/inventory/deviceInventoryService";
import { userOptionsService } from "@/services/users/userOptionsService";
import { characteristicConflicts } from "./conflicts";
import type { RegistrationCharacteristics } from "./types";

export interface DraftIdentityInput {
  modelId?: string | null;
  tradeName?: string;
  manufacturer?: string;
  modelName?: string;
  serialNumber?: string | null;
  udiDi?: string | null;
  inventoryNumber?: string | null;
  purchaseYear?: number | null;
  responsiblePerson?: string | null;
  responsibleUserId?: string | null;
  areaId?: string | null;
  room?: string | null;
}

export interface CreateDraftInput extends DraftIdentityInput {
  productKindCode?: string | null;
  characteristics?: RegistrationCharacteristics | null;
  /** C3 — keep state=draft when deferring incomplete fields. */
  keepDraft?: boolean;
  /** C3 — open clarifications to persist with the draft. */
  clarifications?: {
    kind: string;
    field?: string | null;
    prerequisiteCode?: string | null;
    label: string;
  }[];
}

function parseCharacteristics(raw: string | null | undefined): RegistrationCharacteristics {
  if (!raw) return { produktart: "" };
  try {
    return JSON.parse(raw) as RegistrationCharacteristics;
  } catch {
    return { produktart: "" };
  }
}

export const draftService = {
  async create(ctx: TenantWorkContext, input: CreateDraftInput) {
    requirePermission(ctx, "inventory:update");
    const tenantId = ctx.tenantId;

    if (!input.serialNumber?.trim() && !input.udiDi?.trim()) {
      throw unprocessable("Serial number or UDI-DI is required.", { field: "serialNumber" });
    }

    let modelId = input.modelId ?? null;
    if (!modelId) {
      if (!input.tradeName?.trim() || !input.manufacturer?.trim()) {
        throw unprocessable("Trade name and manufacturer are required.", { field: "tradeName" });
      }
      const model = await prisma.deviceModel.create({
        data: {
          tradeName: input.tradeName.trim(),
          manufacturer: input.manufacturer.trim(),
          modelName: input.modelName?.trim() || input.tradeName.trim(),
          udiDi: input.udiDi?.trim() || null,
          source: "wizard",
          state: "draft",
        },
      });
      modelId = model.id;
    } else {
      const existing = await prisma.deviceModel.findUnique({ where: { id: modelId } });
      if (!existing) throw notFound("Device model not found.");
    }

    if (input.areaId) {
      const area = await prisma.area.findFirst({
        where: { id: input.areaId, site: { tenantId } },
      });
      if (!area) throw unprocessable("Area does not belong to this tenant.", { field: "areaId" });
    }

    const inventoryNumber =
      input.inventoryNumber?.trim() || (await allocateInventoryNumber(tenantId));

    const dup = await prisma.deviceInstance.findFirst({
      where: { tenantId, inventoryNumber },
    });
    if (dup) throw conflict("Inventory number already in use.");

    const characteristics = input.characteristics ?? { produktart: input.productKindCode ?? "" };

    let responsibleUserId = input.responsibleUserId ?? null;
    let responsiblePerson = input.responsiblePerson?.trim() || null;
    if (responsibleUserId) {
      const responsible = await userOptionsService.resolveInTenant(tenantId, responsibleUserId);
      if (!responsible) {
        throw unprocessable("Unknown responsible user.", { field: "responsibleUserId" });
      }
      responsibleUserId = responsible.id;
      responsiblePerson = responsible.name;
    }

    const row = await prisma.deviceInstance.create({
      data: {
        tenantId,
        inventoryNumber,
        serialNumber: input.serialNumber?.trim() || null,
        udiDi: input.udiDi?.trim() || null,
        modelId,
        areaId: input.areaId ?? null,
        room: input.room?.trim() || null,
        responsiblePerson,
        responsibleUserId,
        commissionedAt: input.purchaseYear
          ? new Date(Date.UTC(input.purchaseYear, 0, 1))
          : null,
        state: "draft",
        source: "wizard",
        productKindCode: input.productKindCode ?? characteristics.produktart ?? null,
        characteristicsJson: JSON.stringify(characteristics),
        createdByUserId: ctx.user.id,
        legacyMedgvGroup1: Boolean(characteristics.altgeraet),
        aedExemption: Boolean(characteristics.aedAusnahme),
      },
    });

    if (input.clarifications?.length) {
      for (const c of input.clarifications) {
        await prisma.deviceClarification.create({
          data: {
            tenantId,
            deviceInstanceId: row.id,
            kind: c.kind,
            field: c.field ?? null,
            prerequisiteCode: c.prerequisiteCode ?? null,
            label: c.label,
            deferredBy: ctx.user.name,
            deferredAt: new Date(),
          },
        });
      }
    }

    await prisma.deviceUnitEvent.create({
      data: {
        tenantId,
        deviceInstanceId: row.id,
        actor: ctx.user.name,
        action: "create",
        toState: "draft",
        note: "Initial registration draft created",
      },
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "device",
      resourceId: row.id,
      action: "create",
      summary: `Created registration draft ${row.inventoryNumber}`,
      after: { inventoryNumber: row.inventoryNumber, state: row.state },
    });
    return { id: row.id, inventoryNumber: row.inventoryNumber, state: row.state };
  },

  async update(ctx: TenantWorkContext, id: string, input: CreateDraftInput) {
    requirePermission(ctx, "inventory:update");
    const row = await prisma.deviceInstance.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!row) throw notFound("Draft not found.");
    if (row.state === "released" || row.state === "retired") {
      throw unprocessable("Released or retired records cannot be changed.");
    }

    const characteristics = input.characteristics
      ? input.characteristics
      : parseCharacteristics(row.characteristicsJson);

    if (input.characteristics) {
      const conflicts = characteristicConflicts(characteristics, {
        purchaseYear:
          input.purchaseYear ??
          (row.commissionedAt ? row.commissionedAt.getUTCFullYear() : null),
      });
      if (conflicts.length) {
        throw unprocessable(conflicts.join(" · "), { field: "characteristics", conflicts });
      }
    }

    if (input.areaId) {
      const area = await prisma.area.findFirst({
        where: { id: input.areaId, site: { tenantId: ctx.tenantId } },
      });
      if (!area) throw unprocessable("Area does not belong to this tenant.", { field: "areaId" });
    }

    let responsiblePatch:
      | { responsibleUserId: string | null; responsiblePerson: string | null }
      | undefined;
    if (input.responsibleUserId !== undefined) {
      if (!input.responsibleUserId) {
        responsiblePatch = { responsibleUserId: null, responsiblePerson: null };
      } else {
        const responsible = await userOptionsService.resolveInTenant(
          ctx.tenantId,
          input.responsibleUserId,
        );
        if (!responsible) {
          throw unprocessable("Unknown responsible user.", { field: "responsibleUserId" });
        }
        responsiblePatch = {
          responsibleUserId: responsible.id,
          responsiblePerson: responsible.name,
        };
      }
    } else if (input.responsiblePerson !== undefined) {
      responsiblePatch = {
        responsibleUserId: row.responsibleUserId,
        responsiblePerson: input.responsiblePerson?.trim() || null,
      };
    }

    const updated = await prisma.deviceInstance.update({
      where: { id },
      data: {
        serialNumber: input.serialNumber !== undefined ? input.serialNumber?.trim() || null : undefined,
        udiDi: input.udiDi !== undefined ? input.udiDi?.trim() || null : undefined,
        areaId: input.areaId !== undefined ? input.areaId : undefined,
        room: input.room !== undefined ? input.room?.trim() || null : undefined,
        ...(responsiblePatch ?? {}),
        productKindCode:
          input.productKindCode !== undefined
            ? input.productKindCode
            : characteristics.produktart || row.productKindCode,
        characteristicsJson: input.characteristics ? JSON.stringify(characteristics) : undefined,
        legacyMedgvGroup1: Boolean(characteristics.altgeraet),
        aedExemption: Boolean(characteristics.aedAusnahme),
        commissionedAt:
          input.purchaseYear !== undefined
            ? input.purchaseYear
              ? new Date(Date.UTC(input.purchaseYear, 0, 1))
              : null
            : undefined,
        state: input.keepDraft ? "draft" : "review",
      },
    });

    if (input.clarifications?.length) {
      for (const c of input.clarifications) {
        await prisma.deviceClarification.create({
          data: {
            tenantId: ctx.tenantId,
            deviceInstanceId: updated.id,
            kind: c.kind,
            field: c.field ?? null,
            prerequisiteCode: c.prerequisiteCode ?? null,
            label: c.label,
            deferredBy: ctx.user.name,
            deferredAt: new Date(),
          },
        });
      }
    }

    if (input.tradeName || input.manufacturer || input.modelName) {
      if (updated.modelId) {
        await prisma.deviceModel.update({
          where: { id: updated.modelId },
          data: {
            tradeName: input.tradeName?.trim() || undefined,
            manufacturer: input.manufacturer?.trim() || undefined,
            modelName: input.modelName?.trim() || undefined,
          },
        });
      }
    }

    const diff = changedFields(
      {
        serialNumber: row.serialNumber,
        areaId: row.areaId,
        room: row.room,
        state: row.state,
        responsibleUserId: row.responsibleUserId,
      },
      {
        serialNumber: updated.serialNumber,
        areaId: updated.areaId,
        room: updated.room,
        state: updated.state,
        responsibleUserId: updated.responsibleUserId,
      },
    );
    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "device",
      resourceId: updated.id,
      action: "update",
      summary: `Updated registration draft ${updated.inventoryNumber}`,
      before: diff?.before,
      after: diff?.after,
    });
    return { id: updated.id, inventoryNumber: updated.inventoryNumber, state: updated.state };
  },

  async get(ctx: TenantWorkContext, id: string) {
    requirePermission(ctx, "inventory:view");
    const row = await prisma.deviceInstance.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        model: {
          include: {
            classifications: {
              where: { validTo: null },
              orderBy: { validFrom: "desc" },
              take: 1,
            },
          },
        },
        area: { include: { site: true } },
        clarifications: { where: { resolvedAt: null } },
      },
    });
    if (!row) throw notFound("Draft not found.");

    const openCls = row.model?.classifications[0] ?? null;
    let modelClassificationPrefill: RegistrationCharacteristics | null = null;
    if (openCls?.characteristics) {
      try {
        modelClassificationPrefill = JSON.parse(openCls.characteristics) as RegistrationCharacteristics;
      } catch {
        modelClassificationPrefill = null;
      }
    }

    return {
      id: row.id,
      inventoryNumber: row.inventoryNumber,
      serialNumber: row.serialNumber,
      udiDi: row.udiDi,
      state: row.state,
      productKindCode: row.productKindCode,
      characteristics: parseCharacteristics(row.characteristicsJson),
      responsiblePerson: row.responsiblePerson,
      responsibleUserId: row.responsibleUserId,
      areaId: row.areaId,
      siteId: row.area?.siteId ?? null,
      room: row.room,
      purchaseYear: row.commissionedAt ? row.commissionedAt.getUTCFullYear() : null,
      model: row.model
        ? {
            id: row.model.id,
            tradeName: row.model.tradeName,
            manufacturer: row.model.manufacturer,
            modelName: row.model.modelName,
          }
        : null,
      modelClassificationPrefill,
      modelClassificationConfidence: openCls?.confidence ?? null,
      modelClassificationFieldStates: openCls?.fieldStates
        ? (JSON.parse(openCls.fieldStates) as Record<string, string>)
        : null,
      openClarifications: row.clarifications.map((c) => ({
        id: c.id,
        kind: c.kind,
        field: c.field,
        prerequisiteCode: c.prerequisiteCode,
        label: c.label,
        deferredBy: c.deferredBy,
        deferredAt: c.deferredAt.toISOString(),
      })),
    };
  },
};
