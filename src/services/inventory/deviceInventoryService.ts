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
import {
  assertDeviceInWorkAreas,
  deviceAreaWhere,
  getAssignedAreaIds,
  getEffectiveAreaScope,
} from "@/services/users/userAreaScope";
import { userOptionsService } from "@/services/users/userOptionsService";
import {
  isPurgeAllowed,
  retentionClockOnRetire,
} from "@/services/inventory/retention";
import { Prisma } from "@prisma/client";

const INV_PREFIX = "INV-";
const INV_PAD = 5;

/** Backfill § 13 clock for legacy retired rows that only have retiredAt. */
async function ensureRetentionClock(row: {
  id: string;
  state: string;
  retiredAt: Date | null;
  decommissionedAt: Date | null;
  retainUntil: Date | null;
}) {
  if (row.state !== "retired" || row.decommissionedAt != null) return row;
  const clock = retentionClockOnRetire({
    now: new Date(),
    retiredAt: row.retiredAt,
  });
  await prisma.deviceInstance.update({
    where: { id: row.id },
    data: {
      decommissionedAt: clock.decommissionedAt,
      retainUntil: clock.retainUntil,
    },
  });
  return {
    ...row,
    decommissionedAt: clock.decommissionedAt,
    retainUntil: clock.retainUntil,
  };
}

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
  /** All inventory exemplars whose linked model matches GTIN/UDI-DI. */
  listByGtin(tenantId: string, gtin: string): Promise<DeviceInstanceDTO[]>;
}

const include = {
  model: { include: { classifications: { where: { validTo: null }, take: 1, orderBy: { validFrom: "desc" as const } } } },
  area: { include: { site: true } },
  responsibleUser: { select: { id: true, name: true, email: true } },
} as const;

export interface DeviceListQuery {
  q?: string;
  siteId?: string;
  /** Exact room match (trimmed); empty/undefined = no room filter. */
  room?: string;
  /** draft | review | released | retired | not_released */
  state?: string;
  /**
   * When true, restrict to the caller's assigned work areas
   * (home ∪ UserAreaAssignment), even for unscoped admin roles.
   * Scoped roles (e.g. user) are always filtered by effective areas.
   */
  mineArea?: boolean;
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
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
    prisma.auditEvent.findMany({
      where: { tenantId: row.tenantId, resource: "device", resourceId: row.id },
      orderBy: { occurredAt: "desc" },
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
  /** Retired devices whose retainUntil has passed — eligible for audited purge. */
  listRetentionEligible(ctx: TenantWorkContext): Promise<DeviceInstanceDTO[]>;
  /** Hard-delete retired device + book evidence after retainUntil (audited). */
  purge(ctx: TenantWorkContext, id: string): Promise<{ id: string; inventoryNumber: string }>;
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

  async listByGtin(tenantId, gtin) {
    const code = gtin.trim();
    if (!code) return [];
    const rows = await prisma.deviceInstance.findMany({
      where: {
        tenantId,
        state: { not: "retired" },
        model: {
          OR: [{ udiDi: code }, { basicUdiDi: code }, { gtins: { contains: `"${code}"` } }],
        },
      },
      include,
      orderBy: [{ inventoryNumber: "asc" }],
      take: 100,
    });
    return rows.map(toDeviceInstanceDTO);
  },

  async list(ctx, query = {}) {
    requirePermission(ctx, "inventory:view");
    const q = query.q?.trim();
    const room = query.room?.trim();
    const state = query.state?.trim();

    let areaClause: Prisma.DeviceInstanceWhereInput | undefined;
    if (query.mineArea) {
      const assigned = await getAssignedAreaIds(ctx);
      if (assigned.length === 0) return [];
      areaClause = { areaId: { in: assigned } };
    } else {
      const scope = await getEffectiveAreaScope(ctx);
      const frag = deviceAreaWhere(scope);
      if (frag === "empty") return [];
      if (frag) areaClause = frag;
    }

    const stateWhere: Prisma.DeviceInstanceWhereInput | undefined =
      state === "not_released"
        ? { state: { not: "released" } }
        : state === "draft" || state === "review" || state === "released" || state === "retired"
          ? { state }
          : undefined;

    const where: Prisma.DeviceInstanceWhereInput = {
      tenantId: ctx.tenantId,
      ...(query.siteId ? { area: { siteId: query.siteId } } : {}),
      ...(areaClause ?? {}),
      ...(room ? { room } : {}),
      ...(stateWhere ?? {}),
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
    let row = await loadInstance(id, ctx.tenantId);
    if (!row) throw notFound("Device not found.");
    await assertDeviceInWorkAreas(ctx, row.areaId);
    if (row.state === "retired" && row.decommissionedAt == null) {
      await ensureRetentionClock(row);
      row = await loadInstance(id, ctx.tenantId);
      if (!row) throw notFound("Device not found.");
    }
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
    if (!row) return null;
    // Tenant-wide duplicate lookup — area scope enforced on get / resolve / list.
    return toDeviceInstanceDTO(row);
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
      await assertDeviceInWorkAreas(ctx, input.areaId);
    } else {
      const scope = await getEffectiveAreaScope(ctx);
      if (scope.mode === "areas" || scope.mode === "none") {
        throw unprocessable("Choose a work area you are assigned to.", { field: "areaId" });
      }
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
    await assertDeviceInWorkAreas(ctx, existing.areaId);

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
      await assertDeviceInWorkAreas(ctx, input.areaId);
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
              ? (() => {
                  const now = new Date();
                  const clock = retentionClockOnRetire({
                    now,
                    retiredAt: now,
                  });
                  // First decommission sets the § 13 clock; later re-retire keeps original.
                  const firstClock = existing.decommissionedAt == null;
                  return {
                    retiredAt: now,
                    ...(firstClock
                      ? {
                          decommissionedAt: clock.decommissionedAt,
                          retainUntil: clock.retainUntil,
                        }
                      : {}),
                  };
                })()
              : {}),
            ...(input.state !== undefined &&
            input.state !== "retired" &&
            existing.retiredAt != null
              ? {
                  // Workflow may leave retirement; legal clock stays for the book.
                  retiredAt: null,
                }
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
    await assertDeviceInWorkAreas(ctx, existing.areaId);

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

  async listRetentionEligible(ctx) {
    requirePermission(ctx, "inventory:view");
    const scope = await getEffectiveAreaScope(ctx);
    if (scope.mode === "none") return [];

    const today = new Date();
    const retired = await prisma.deviceInstance.findMany({
      where: {
        state: "retired",
        ...(scope.mode === "areas" ? { areaId: { in: scope.areaIds } } : {}),
      },
      include,
      take: 500,
    });

    const eligible: DeviceInstanceDTO[] = [];
    for (const row of retired) {
      const withClock = await ensureRetentionClock(row);
      if (isPurgeAllowed(withClock.retainUntil, today)) {
        const full = await loadInstance(row.id, ctx.tenantId);
        if (full) eligible.push(toDeviceInstanceDTO(full));
      }
    }
    return eligible;
  },

  async purge(ctx, id) {
    requirePermission(ctx, "inventory:update");
    const existing = await loadInstance(id, ctx.tenantId);
    if (!existing) throw notFound("Device not found.");
    await assertDeviceInWorkAreas(ctx, existing.areaId);

    if (existing.state !== "retired") {
      throw unprocessable("Only retired devices can be purged.", { field: "state" });
    }

    const withClock = await ensureRetentionClock(existing);
    if (!isPurgeAllowed(withClock.retainUntil)) {
      throw unprocessable(
        `Book must be retained until ${withClock.retainUntil?.toISOString().slice(0, 10) ?? "—"}. Purge refused.`,
        {
          field: "retainUntil",
          retainUntil: withClock.retainUntil?.toISOString().slice(0, 10) ?? null,
        },
      );
    }

    const inventoryNumber = existing.inventoryNumber;

    await prisma.$transaction(async (tx) => {
      await tx.deviceBookEntry.deleteMany({ where: { deviceInstanceId: id } });
      await tx.deviceEvidence.deleteMany({ where: { deviceInstanceId: id } });
      await tx.fieldSafetyDeviceAction.deleteMany({ where: { deviceInstanceId: id } });
      await tx.constancyCadence.deleteMany({ where: { deviceInstanceId: id } });
      await tx.dutyOverlapDecision.deleteMany({ where: { deviceInstanceId: id } });
      await tx.deviceIncident.deleteMany({ where: { deviceInstanceId: id } });
      await tx.reprocessingBatchItem.deleteMany({ where: { deviceInstanceId: id } });
      await tx.reprocessingCheck.deleteMany({ where: { equipmentDeviceId: id } });
      await tx.reprocessingBatch.deleteMany({ where: { equipmentDeviceId: id } });
      await tx.reprocessingOnDevice.deleteMany({
        where: { OR: [{ profileDeviceId: id }, { equipmentDeviceId: id }] },
      });
      await tx.deviceReprocessingProfile.deleteMany({ where: { deviceInstanceId: id } });
      await tx.baselineMeasurement.deleteMany({ where: { deviceInstanceId: id } });
      await tx.inspectionStepResult.deleteMany({
        where: { run: { deviceInstanceId: id } },
      });
      await tx.inspectionRun.deleteMany({ where: { deviceInstanceId: id } });
      const dutyIds = (
        await tx.deviceDuty.findMany({
          where: { deviceInstanceId: id },
          select: { id: true },
        })
      ).map((d) => d.id);
      if (dutyIds.length > 0) {
        await tx.dutyReminder.deleteMany({ where: { deviceDutyId: { in: dutyIds } } });
        await tx.dutyPerformance.deleteMany({ where: { deviceDutyId: { in: dutyIds } } });
      }
      await tx.deviceDuty.deleteMany({ where: { deviceInstanceId: id } });
      await tx.deviceClarification.deleteMany({ where: { deviceInstanceId: id } });
      await tx.deviceUnitEvent.deleteMany({ where: { deviceInstanceId: id } });
      await tx.maintenanceEvent.deleteMany({ where: { deviceInstanceId: id } });
      await tx.deviceReleaseSnapshot.deleteMany({ where: { deviceInstanceId: id } });
      await tx.authorityNotification.deleteMany({ where: { deviceInstanceId: id } });
      await tx.authorityFinding.updateMany({
        where: { deviceInstanceId: id },
        data: { deviceInstanceId: null },
      });
      await tx.deviceInstance.updateMany({
        where: { parentInstanceId: id },
        data: { parentInstanceId: null },
      });
      await tx.deviceInstance.delete({ where: { id } });
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "device",
      resourceId: id,
      action: "purge",
      summary: `Purged retired inventory ${inventoryNumber} after retention`,
      after: {
        inventoryNumber,
        retainUntil: withClock.retainUntil?.toISOString().slice(0, 10) ?? null,
      },
    });

    return { id, inventoryNumber };
  },
};

export async function findInstanceById(id: string, tenantId: string): Promise<DeviceInstanceDTO | null> {
  const row = await loadInstance(id, tenantId);
  return row ? toDeviceInstanceDTO(row) : null;
}
