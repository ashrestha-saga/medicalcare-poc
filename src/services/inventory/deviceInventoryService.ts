import type {
  DeviceInstanceDetailDTO,
  DeviceInstanceDTO,
  ModelClassificationDTO,
  ParsedIdentifier,
  TenantWorkContext,
} from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { changedFields, recordAudit } from "@/services/audit/auditService";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { toDeviceInstanceDTO } from "@/services/shared/mappers";
import { inspectionTagsFromFlags } from "@/lib/inspectionTags";
import {
  computeNextMaintenanceDueAt,
  resolveMaintenanceCycleMonths,
} from "@/lib/maintenance/schedule";
import { listDutiesForInstance, nextObligationDueAt, syncWartungDutyOnComplete } from "@/services/registration/dutyService";
import type { CreateDeviceInput, UpdateDeviceInput } from "@/schemas/device";
import { userOptionsService } from "@/services/users/userOptionsService";
import { Prisma } from "@prisma/client";

const INV_PREFIX = "INV-";
const INV_PAD = 5;

/** Next tenant-scoped incremental inventarnummer: INV-00001, INV-00002, … */
export async function allocateInventoryNumber(
  tenantId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<string> {
  const rows = await tx.deviceInstance.findMany({
    where: { tenantId, inventoryNumber: { startsWith: INV_PREFIX } },
    select: { inventoryNumber: true },
  });
  let max = 0;
  for (const row of rows) {
    const m = /^INV-(\d+)$/i.exec(row.inventoryNumber);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${INV_PREFIX}${String(max + 1).padStart(INV_PAD, "0")}`;
}

/**
 * Stage 1 — FA-100 — own device inventory.
 * Every query is scoped by tenantId (NFA-804).
 */
export interface InventoryResolver {
  find(identifier: ParsedIdentifier, tenantId: string): Promise<DeviceInstanceDTO | null>;
}

const include = {
  model: { include: { classifications: { where: { validTo: null }, take: 1, orderBy: { validFrom: "desc" as const } } } },
  area: { include: { site: true } },
  responsibleUser: { select: { id: true, name: true, email: true } },
} as const;

export interface DeviceListQuery {
  q?: string;
  siteId?: string;
}

function parseCommissionedAt(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) {
    return new Date(`${trimmed}-01-01T00:00:00.000Z`);
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) throw unprocessable("Invalid commissioned date.", { field: "commissionedAt" });
  return d;
}

async function resolveModelClassification(
  modelId: string | null,
): Promise<ModelClassificationDTO | null> {
  if (!modelId) return null;

  const [cls, instanceCount] = await Promise.all([
    prisma.deviceModelClassification.findFirst({
      where: { deviceModelId: modelId, validTo: null },
      orderBy: { validFrom: "desc" },
    }),
    prisma.deviceInstance.count({ where: { modelId } }),
  ]);

  if (!cls) {
    return {
      annex1: null,
      annex2: null,
      softwareClass: null,
      radiation: null,
      confidence: null,
      source: null,
      instanceCount,
    };
  }

  return {
    annex1: cls.stk,
    annex2: cls.mtkItemId != null || Boolean(cls.evidenceText?.includes("annex2-asserted")),
    softwareClass: cls.softwareClass,
    radiation: cls.radiation,
    confidence: cls.confidence,
    source: cls.evidenceText,
    instanceCount,
  };
}

async function buildDeviceCourse(
  row: NonNullable<Awaited<ReturnType<typeof loadInstance>>>,
): Promise<DeviceInstanceDetailDTO["course"]> {
  const [unitEvents, audits] = await Promise.all([
    prisma.deviceUnitEvent.findMany({
      where: { deviceInstanceId: row.id, tenantId: row.tenantId },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.auditEvent.findMany({
      where: { tenantId: row.tenantId, resource: "device", resourceId: row.id },
      orderBy: { occurredAt: "asc" },
      take: 80,
    }),
  ]);

  const course: DeviceInstanceDetailDTO["course"] = unitEvents.map((e) => ({
    label: e.note?.trim() || e.action,
    at: e.occurredAt.toISOString(),
    actor: e.actor || null,
    actorKind: null,
    organisationName: null,
  }));

  for (const e of audits) {
    course.push({
      label: e.summary || e.action,
      at: e.occurredAt.toISOString(),
      actor: e.actorName,
      actorKind: e.actorKind,
      organisationName: e.organisationName,
    });
  }

  if (course.length === 0) {
    course.push({
      label: "Created",
      at: row.createdAt.toISOString(),
      actor: null,
      actorKind: null,
      organisationName: null,
    });
  }

  course.sort((a, b) => a.at.localeCompare(b.at));
  return course;
}

async function toDetailDTO(row: NonNullable<Awaited<ReturnType<typeof loadInstance>>>): Promise<DeviceInstanceDetailDTO> {
  const base = toDeviceInstanceDTO(row);
  const modelClassification = await resolveModelClassification(row.modelId);
  const inspectionTags =
    base.inspectionTags.length > 0
      ? base.inspectionTags
      : inspectionTagsFromFlags(modelClassification);
  const duties = await listDutiesForInstance(row.tenantId, row.id);
  return {
    ...base,
    inspectionTags,
    udiDi: row.model?.udiDi ?? null,
    modelSource: (row.model?.source as DeviceInstanceDetailDTO["modelSource"]) ?? null,
    modelState: (row.model?.state as DeviceInstanceDetailDTO["modelState"]) ?? null,
    modelMaintenanceCycleMonths: row.model?.maintenanceCycleMonths ?? null,
    modelClassification,
    course: await buildDeviceCourse(row),
    duties,
    nextObligationDueAt: nextObligationDueAt(duties),
  };
}

async function loadInstance(id: string, tenantId: string) {
  return prisma.deviceInstance.findFirst({ where: { id, tenantId }, include });
}

export const deviceInventoryService: InventoryResolver & {
  list(ctx: TenantWorkContext, query?: DeviceListQuery): Promise<DeviceInstanceDTO[]>;
  get(ctx: TenantWorkContext, id: string): Promise<DeviceInstanceDetailDTO>;
  findBySerial(
    ctx: TenantWorkContext,
    serialNumber: string,
    modelId?: string | null,
  ): Promise<DeviceInstanceDTO | null>;
  create(ctx: TenantWorkContext, input: CreateDeviceInput): Promise<DeviceInstanceDetailDTO>;
  update(ctx: TenantWorkContext, id: string, input: UpdateDeviceInput): Promise<DeviceInstanceDetailDTO>;
  completeMaintenance(
    ctx: TenantWorkContext,
    id: string,
    input?: { performedAt?: string | null; note?: string | null },
  ): Promise<DeviceInstanceDetailDTO>;
} = {
  async find(identifier, tenantId) {
    const candidates = new Set<string>();
    if (identifier.text) candidates.add(identifier.text);
    if (identifier.serial) candidates.add(identifier.serial);
    for (const c of [...candidates]) {
      const m = /^(INV|SN)[-_]?(\w+)$/i.exec(c);
      if (m) {
        candidates.add(`${m[1].toUpperCase()}-${m[2]}`);
        candidates.add(`${m[1].toUpperCase()}${m[2]}`);
      }
    }
    if (candidates.size === 0 && !identifier.gtin) return null;

    const values = [...candidates];

    if (values.length > 0) {
      const byNumber = await prisma.deviceInstance.findFirst({
        where: {
          tenantId,
          OR: [{ inventoryNumber: { in: values } }, { serialNumber: { in: values } }],
        },
        include,
      });
      if (byNumber) return toDeviceInstanceDTO(byNumber);
    }

    if (identifier.gtin && identifier.serial) {
      const bySerialAndModel = await prisma.deviceInstance.findFirst({
        where: {
          tenantId,
          serialNumber: { in: values },
          model: { OR: [{ udiDi: identifier.gtin }, { gtins: { contains: identifier.gtin } }] },
        },
        include,
      });
      if (bySerialAndModel) return toDeviceInstanceDTO(bySerialAndModel);
    }

    return null;
  },

  async list(ctx, query = {}) {
    requirePermission(ctx, "inventory:view");
    const q = query.q?.trim();
    const where: Prisma.DeviceInstanceWhereInput = {
      tenantId: ctx.tenantId,
      ...(query.siteId ? { area: { siteId: query.siteId } } : {}),
      ...(q
        ? {
            OR: [
              { inventoryNumber: { contains: q } },
              { serialNumber: { contains: q } },
              { responsiblePerson: { contains: q } },
              { room: { contains: q } },
              { model: { tradeName: { contains: q } } },
              { model: { modelName: { contains: q } } },
              { model: { manufacturer: { contains: q } } },
              { area: { name: { contains: q } } },
              { area: { site: { name: { contains: q } } } },
            ],
          }
        : {}),
    };

    const rows = await prisma.deviceInstance.findMany({
      where,
      include,
      orderBy: [{ inventoryNumber: "asc" }],
      take: 500,
    });

    return rows.map(toDeviceInstanceDTO);
  },

  async get(ctx, id) {
    requirePermission(ctx, "inventory:view");
    const row = await loadInstance(id, ctx.tenantId);
    if (!row) throw notFound("Device not found.");
    return toDetailDTO(row);
  },

  async findBySerial(ctx, serialNumber, modelId) {
    requirePermission(ctx, "inventory:view");
    const serial = serialNumber.trim();
    if (!serial) return null;
    const row = await prisma.deviceInstance.findFirst({
      where: {
        tenantId: ctx.tenantId,
        serialNumber: serial,
        ...(modelId ? { modelId } : {}),
      },
      include,
    });
    return row ? toDeviceInstanceDTO(row) : null;
  },

  async create(ctx, input) {
    // Capturers (requests:create) may inventarize after a catalog/BEUDAMED request.
    requirePermission(ctx, "inventory:update", "requests:create");

    const serial = input.serialNumber.trim();
    if (!serial) throw unprocessable("Serial number is required.", { field: "serialNumber" });

    const model = await prisma.deviceModel.findUnique({ where: { id: input.modelId } });
    if (!model) throw unprocessable("Unknown device model.", { field: "modelId" });

    if (input.areaId) {
      const area = await prisma.area.findFirst({
        where: { id: input.areaId, site: { tenantId: ctx.tenantId } },
      });
      if (!area) throw unprocessable("Unknown area for this tenant.", { field: "areaId" });
    }

    const existing = await prisma.deviceInstance.findFirst({
      where: {
        tenantId: ctx.tenantId,
        serialNumber: serial,
        modelId: input.modelId,
      },
      include,
    });
    if (existing) {
      throw conflict("Device with this serial number is already in the inventory.", {
        field: "serialNumber",
        device: toDeviceInstanceDTO(existing),
      });
    }

    const commissionedAt = parseCommissionedAt(input.commissionedAt) ?? null;
    const now = new Date();
    // Inventarize path: do not set a maintenance cycle — Erstanlage derives it from duties.
    const cycleMonths =
      input.maintenanceCycleMonths !== undefined && input.maintenanceCycleMonths !== null
        ? resolveMaintenanceCycleMonths(input.maintenanceCycleMonths, null)
        : null;
    const maintenanceAnchorAt = commissionedAt ?? now;
    const nextMaintenanceDueAt = cycleMonths
      ? computeNextMaintenanceDueAt({
          cycleMonths,
          anchorAt: maintenanceAnchorAt,
        })
      : null;

    const responsible =
      input.responsibleUserId !== undefined
        ? await userOptionsService.resolveInTenant(ctx.tenantId, input.responsibleUserId)
        : null;
    if (input.responsibleUserId && !responsible) {
      throw unprocessable("Unknown responsible user.", { field: "responsibleUserId" });
    }
    const responsiblePerson =
      responsible?.name ?? (input.responsiblePerson?.trim() || null);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const inventoryNumber = await allocateInventoryNumber(ctx.tenantId, tx);
        return tx.deviceInstance.create({
          data: {
            tenantId: ctx.tenantId,
            inventoryNumber,
            serialNumber: serial,
            modelId: input.modelId,
            areaId: input.areaId ?? null,
            room: input.room?.trim() || null,
            responsibleUserId: responsible?.id ?? null,
            responsiblePerson,
            commissionedAt,
            maintenanceCycleMonths: cycleMonths,
            maintenanceAnchorAt,
            lastMaintainedAt: null,
            nextMaintenanceDueAt,
            state: "draft",
            source: "wizard",
            createdByUserId: ctx.user.id,
          },
          include,
        });
      });
      await recordAudit({
        actor: actorFromContext(ctx),
        resource: "device",
        resourceId: created.id,
        action: "create",
        summary: `Created inventory ${created.inventoryNumber}`,
        after: {
          inventoryNumber: created.inventoryNumber,
          serialNumber: created.serialNumber,
          areaId: created.areaId,
          state: created.state,
        },
      });
      const detail = await toDetailDTO(created);
      return { ...detail, registrationPath: `/registration/${created.id}` };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw conflict("Inventory number already in use. Please try again.");
      }
      throw err;
    }
  },

  async update(ctx, id, input) {
    requirePermission(ctx, "inventory:update");
    const existing = await loadInstance(id, ctx.tenantId);
    if (!existing) throw notFound("Device not found.");

    if (existing.model?.state && existing.model.state !== "released") {
      throw unprocessable(
        "Catalog model is under review — inventory details cannot be edited until the model is released.",
        { field: "modelState", modelState: existing.model.state },
      );
    }

    const nextState = input.state ?? existing.state;
    const identityMutable = nextState !== "released" && nextState !== "retired";

    if (existing.state === "released" && nextState === "released") {
      const nextCommissionedPreview = parseCommissionedAt(input.commissionedAt);
      const commissionedChanged =
        input.commissionedAt !== undefined &&
        (() => {
          const raw = input.commissionedAt;
          if (raw === null || (typeof raw === "string" && raw.trim() === "")) {
            return existing.commissionedAt != null;
          }
          if (typeof raw === "string" && /^\d{4}$/.test(raw.trim())) {
            return (
              existing.commissionedAt == null ||
              Number(raw.trim()) !== existing.commissionedAt.getUTCFullYear()
            );
          }
          return (
            (nextCommissionedPreview?.getTime() ?? null) !==
            (existing.commissionedAt?.getTime() ?? null)
          );
        })();
      const identityChanged =
        (input.inventoryNumber !== undefined &&
          input.inventoryNumber !== existing.inventoryNumber) ||
        (input.serialNumber !== undefined &&
          (input.serialNumber ?? null) !== (existing.serialNumber ?? null)) ||
        commissionedChanged ||
        (input.tradeName !== undefined &&
          (input.tradeName ?? null) !== (existing.model?.tradeName ?? null)) ||
        (input.modelName !== undefined &&
          (input.modelName ?? null) !== (existing.model?.modelName ?? null)) ||
        (input.manufacturer !== undefined &&
          (input.manufacturer ?? null) !== (existing.model?.manufacturer ?? null)) ||
        (input.udiDi !== undefined &&
          (input.udiDi ?? null) !== (existing.model?.udiDi ?? null));
      if (identityChanged) {
        throw unprocessable("Released records are immutable (identity/classification).", {
          field: "state",
        });
      }
    }

    if (input.areaId) {
      const area = await prisma.area.findFirst({
        where: { id: input.areaId, site: { tenantId: ctx.tenantId } },
      });
      if (!area) throw unprocessable("Unknown area for this tenant.", { field: "areaId" });
    }

    if (
      identityMutable &&
      input.inventoryNumber &&
      input.inventoryNumber !== existing.inventoryNumber
    ) {
      const clash = await prisma.deviceInstance.findFirst({
        where: {
          tenantId: ctx.tenantId,
          inventoryNumber: input.inventoryNumber,
          NOT: { id },
        },
      });
      if (clash) throw conflict("Inventory number already in use.");
    }

    const commissionedAt = identityMutable ? parseCommissionedAt(input.commissionedAt) : undefined;

    let responsiblePatch: { responsibleUserId: string | null; responsiblePerson: string | null } | undefined;
    if (input.responsibleUserId !== undefined) {
      if (input.responsibleUserId === null || input.responsibleUserId === "") {
        responsiblePatch = { responsibleUserId: null, responsiblePerson: null };
      } else {
        const responsible = await userOptionsService.resolveInTenant(ctx.tenantId, input.responsibleUserId);
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
        responsibleUserId: existing.responsibleUserId,
        responsiblePerson: input.responsiblePerson,
      };
    }

    const nextCycle =
      input.maintenanceCycleMonths !== undefined
        ? input.maintenanceCycleMonths
        : existing.maintenanceCycleMonths;
    const nextCommissioned =
      commissionedAt !== undefined ? commissionedAt : existing.commissionedAt;
    const scheduleTouched =
      input.maintenanceCycleMonths !== undefined || commissionedAt !== undefined;
    const nextAnchor = scheduleTouched
      ? (nextCommissioned ?? existing.maintenanceAnchorAt ?? existing.createdAt)
      : existing.maintenanceAnchorAt;
    const nextDue = scheduleTouched
      ? computeNextMaintenanceDueAt({
          cycleMonths: nextCycle,
          anchorAt: nextAnchor,
          lastMaintainedAt: existing.lastMaintainedAt,
        })
      : undefined;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.deviceInstance.update({
          where: { id },
          data: {
            ...(input.state !== undefined ? { state: input.state } : {}),
            ...(input.state === "retired" && existing.state !== "retired"
              ? { retiredAt: new Date() }
              : {}),
            ...(input.state !== undefined &&
            input.state !== "retired" &&
            existing.retiredAt != null
              ? { retiredAt: null }
              : {}),
            ...(identityMutable && input.inventoryNumber !== undefined
              ? { inventoryNumber: input.inventoryNumber }
              : {}),
            ...(identityMutable && input.serialNumber !== undefined
              ? { serialNumber: input.serialNumber }
              : {}),
            ...(responsiblePatch ?? {}),
            ...(input.room !== undefined ? { room: input.room } : {}),
            ...(input.areaId !== undefined ? { areaId: input.areaId } : {}),
            ...(identityMutable && commissionedAt !== undefined ? { commissionedAt } : {}),
            ...(input.maintenanceCycleMonths !== undefined
              ? { maintenanceCycleMonths: input.maintenanceCycleMonths }
              : {}),
            ...(scheduleTouched
              ? {
                  maintenanceAnchorAt: nextAnchor,
                  nextMaintenanceDueAt: nextDue ?? null,
                }
              : {}),
          },
        });

        if (
          scheduleTouched &&
          (existing.maintenanceCycleMonths !== nextCycle ||
            existing.nextMaintenanceDueAt?.getTime() !== nextDue?.getTime())
        ) {
          await tx.maintenanceEvent.create({
            data: {
              tenantId: ctx.tenantId,
              deviceInstanceId: id,
              kind: "cycle_changed",
              performedAt: new Date(),
              previousDueAt: existing.nextMaintenanceDueAt,
              nextDueAt: nextDue ?? null,
              cycleMonths: nextCycle,
              actorUserId: ctx.user.id,
            },
          });
        }

        const modelPatch = identityMutable
          ? {
              ...(input.tradeName !== undefined ? { tradeName: input.tradeName } : {}),
              ...(input.modelName !== undefined ? { modelName: input.modelName } : {}),
              ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer } : {}),
              ...(input.udiDi !== undefined ? { udiDi: input.udiDi } : {}),
              ...(input.modelMaintenanceCycleMonths !== undefined
                ? { maintenanceCycleMonths: input.modelMaintenanceCycleMonths }
                : {}),
            }
          : {
              ...(input.modelMaintenanceCycleMonths !== undefined
                ? { maintenanceCycleMonths: input.modelMaintenanceCycleMonths }
                : {}),
            };
        if (existing.modelId && Object.keys(modelPatch).length > 0) {
          await tx.deviceModel.update({
            where: { id: existing.modelId },
            data: modelPatch,
          });
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw conflict("Inventory number already in use.");
      }
      throw err;
    }

    const refreshed = await loadInstance(id, ctx.tenantId);
    if (!refreshed) throw notFound("Device not found.");
    const diff = changedFields(
      {
        state: existing.state,
        areaId: existing.areaId,
        room: existing.room,
        serialNumber: existing.serialNumber,
        responsibleUserId: existing.responsibleUserId,
        inventoryNumber: existing.inventoryNumber,
      },
      {
        state: refreshed.state,
        areaId: refreshed.areaId,
        room: refreshed.room,
        serialNumber: refreshed.serialNumber,
        responsibleUserId: refreshed.responsibleUserId,
        inventoryNumber: refreshed.inventoryNumber,
      },
    );
    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "device",
      resourceId: id,
      action: "update",
      summary: `Updated inventory ${refreshed.inventoryNumber}`,
      before: diff?.before,
      after: diff?.after,
    });
    return toDetailDTO(refreshed);
  },

  async completeMaintenance(ctx, id, input) {
    requirePermission(ctx, "inventory:update");
    const existing = await loadInstance(id, ctx.tenantId);
    if (!existing) throw notFound("Device not found.");

    const cycle = existing.maintenanceCycleMonths;
    if (cycle == null || cycle <= 0) {
      throw unprocessable("Set a maintenance cycle (months) before marking maintenance done.", {
        field: "maintenanceCycleMonths",
      });
    }

    let performedAt = new Date();
    if (input?.performedAt?.trim()) {
      const parsed = new Date(input.performedAt.trim());
      if (Number.isNaN(parsed.getTime())) {
        throw unprocessable("Invalid performed date.", { field: "performedAt" });
      }
      performedAt = parsed;
    }

    const previousDueAt = existing.nextMaintenanceDueAt;
    const nextDueAt = computeNextMaintenanceDueAt({
      cycleMonths: cycle,
      anchorAt: existing.maintenanceAnchorAt ?? existing.commissionedAt ?? existing.createdAt,
      lastMaintainedAt: performedAt,
    });

    await prisma.$transaction(async (tx) => {
      await tx.deviceInstance.update({
        where: { id },
        data: {
          lastMaintainedAt: performedAt,
          nextMaintenanceDueAt: nextDueAt,
        },
      });
      await tx.maintenanceEvent.create({
        data: {
          tenantId: ctx.tenantId,
          deviceInstanceId: id,
          kind: "completed",
          performedAt,
          previousDueAt,
          nextDueAt,
          cycleMonths: cycle,
          note: input?.note?.trim() || null,
          actorUserId: ctx.user.id,
        },
      });
      await syncWartungDutyOnComplete(tx, {
        tenantId: ctx.tenantId,
        deviceInstanceId: id,
        performedAt,
        performedBy: ctx.user.name,
        actorUserId: ctx.user.id,
        note: input?.note?.trim() || null,
        skipMaintenanceEvent: true,
      });
    });

    const refreshed = await loadInstance(id, ctx.tenantId);
    if (!refreshed) throw notFound("Device not found.");
    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "device",
      resourceId: id,
      action: "complete",
      summary: `Completed maintenance for ${refreshed.inventoryNumber}`,
      after: { performedAt: performedAt.toISOString(), nextDueAt: nextDueAt?.toISOString() ?? null },
    });
    return toDetailDTO(refreshed);
  },
};

export async function findInstanceById(id: string, tenantId: string): Promise<DeviceInstanceDTO | null> {
  const row = await loadInstance(id, tenantId);
  return row ? toDeviceInstanceDTO(row) : null;
}
