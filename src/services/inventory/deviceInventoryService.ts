import type {
  DeviceInstanceDetailDTO,
  DeviceInstanceDTO,
  ModelClassificationDTO,
  ParsedIdentifier,
  TenantContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { toDeviceInstanceDTO } from "@/services/shared/mappers";
import { inspectionTagsFromFlags } from "@/lib/inspectionTags";
import {
  computeNextMaintenanceDueAt,
  resolveMaintenanceCycleMonths,
} from "@/lib/maintenance/schedule";
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
  model: true,
  area: { include: { site: true } },
  classification: true,
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

  const [proposal, instanceCount] = await Promise.all([
    prisma.classificationProposal.findFirst({
      where: { deviceModelId: modelId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.deviceInstance.count({ where: { modelId } }),
  ]);

  if (proposal) {
    return {
      annex1: proposal.annex1,
      annex2: proposal.annex2,
      softwareClass: proposal.softwareClass,
      radiation: proposal.radiation,
      confidence: proposal.confidence,
      source: proposal.source,
      instanceCount,
    };
  }

  const model = await prisma.deviceModel.findUnique({ where: { id: modelId } });
  if (!model) return null;

  const rule =
    (model.emdnCode
      ? await prisma.classificationRule.findFirst({
          where: { matchType: "emdn", matchValue: model.emdnCode },
          orderBy: { createdAt: "desc" },
        })
      : null) ??
    (model.manufacturer && model.modelName
      ? await prisma.classificationRule.findFirst({
          where: {
            matchType: "manufacturerModel",
            matchValue: `${model.manufacturer}|${model.modelName}`,
          },
          orderBy: { createdAt: "desc" },
        })
      : null);

  if (!rule) {
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
    annex1: rule.annex1,
    annex2: rule.annex2,
    softwareClass: rule.softwareClass,
    radiation: rule.radiation,
    confidence: rule.confidence,
    source: rule.source,
    instanceCount,
  };
}

async function toDetailDTO(row: NonNullable<Awaited<ReturnType<typeof loadInstance>>>): Promise<DeviceInstanceDetailDTO> {
  const base = toDeviceInstanceDTO(row);
  const modelClassification = await resolveModelClassification(row.modelId);
  const inspectionTags =
    base.inspectionTags.length > 0
      ? base.inspectionTags
      : inspectionTagsFromFlags(modelClassification);
  return {
    ...base,
    inspectionTags,
    udiDi: row.model?.udiDi ?? null,
    modelSource: (row.model?.source as DeviceInstanceDetailDTO["modelSource"]) ?? null,
    modelState: (row.model?.state as DeviceInstanceDetailDTO["modelState"]) ?? null,
    modelMaintenanceCycleMonths: row.model?.maintenanceCycleMonths ?? null,
    modelClassification,
    course: [
      {
        label: "Created",
        at: row.createdAt.toISOString(),
        actor: null,
      },
      ...(row.lastMaintainedAt
        ? [
            {
              label: "Maintenance completed",
              at: row.lastMaintainedAt.toISOString(),
              actor: null,
            },
          ]
        : []),
      ...(row.updatedAt.getTime() !== row.createdAt.getTime()
        ? [
            {
              label: "Last updated",
              at: row.updatedAt.toISOString(),
              actor: null,
            },
          ]
        : []),
    ],
  };
}

async function loadInstance(id: string, tenantId: string) {
  return prisma.deviceInstance.findFirst({ where: { id, tenantId }, include });
}

export const deviceInventoryService: InventoryResolver & {
  list(ctx: TenantContext, query?: DeviceListQuery): Promise<DeviceInstanceDTO[]>;
  get(ctx: TenantContext, id: string): Promise<DeviceInstanceDetailDTO>;
  findBySerial(
    ctx: TenantContext,
    serialNumber: string,
    modelId?: string | null,
  ): Promise<DeviceInstanceDTO | null>;
  create(ctx: TenantContext, input: CreateDeviceInput): Promise<DeviceInstanceDetailDTO>;
  update(ctx: TenantContext, id: string, input: UpdateDeviceInput): Promise<DeviceInstanceDetailDTO>;
  completeMaintenance(
    ctx: TenantContext,
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

    const dtos = rows.map(toDeviceInstanceDTO);
    const modelIds = [
      ...new Set(dtos.map((d) => d.modelId).filter((id): id is string => Boolean(id))),
    ];
    if (!modelIds.length) return dtos;

    const proposals = await prisma.classificationProposal.findMany({
      where: { deviceModelId: { in: modelIds } },
      orderBy: { createdAt: "desc" },
    });
    const latestByModel = new Map<string, (typeof proposals)[number]>();
    for (const p of proposals) {
      if (!latestByModel.has(p.deviceModelId)) latestByModel.set(p.deviceModelId, p);
    }

    return dtos.map((dto) => {
      if (dto.inspectionTags.length || !dto.modelId) return dto;
      const proposal = latestByModel.get(dto.modelId);
      return {
        ...dto,
        inspectionTags: inspectionTagsFromFlags(proposal),
      };
    });
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
    const cycleMonths = resolveMaintenanceCycleMonths(
      input.maintenanceCycleMonths,
      model.maintenanceCycleMonths,
    );
    const maintenanceAnchorAt = commissionedAt ?? now;
    const nextMaintenanceDueAt = computeNextMaintenanceDueAt({
      cycleMonths,
      anchorAt: maintenanceAnchorAt,
    });

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
          },
          include,
        });
      });
      return toDetailDTO(created);
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

    if (input.areaId) {
      const area = await prisma.area.findFirst({
        where: { id: input.areaId, site: { tenantId: ctx.tenantId } },
      });
      if (!area) throw unprocessable("Unknown area for this tenant.", { field: "areaId" });
    }

    if (input.inventoryNumber && input.inventoryNumber !== existing.inventoryNumber) {
      const clash = await prisma.deviceInstance.findFirst({
        where: {
          tenantId: ctx.tenantId,
          inventoryNumber: input.inventoryNumber,
          NOT: { id },
        },
      });
      if (clash) throw conflict("Inventory number already in use.");
    }

    const commissionedAt = parseCommissionedAt(input.commissionedAt);

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
            ...(input.inventoryNumber !== undefined ? { inventoryNumber: input.inventoryNumber } : {}),
            ...(input.serialNumber !== undefined ? { serialNumber: input.serialNumber } : {}),
            ...(responsiblePatch ?? {}),
            ...(input.room !== undefined ? { room: input.room } : {}),
            ...(input.areaId !== undefined ? { areaId: input.areaId } : {}),
            ...(commissionedAt !== undefined ? { commissionedAt } : {}),
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

        const modelPatch = {
          ...(input.tradeName !== undefined ? { tradeName: input.tradeName } : {}),
          ...(input.modelName !== undefined ? { modelName: input.modelName } : {}),
          ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer } : {}),
          ...(input.udiDi !== undefined ? { udiDi: input.udiDi } : {}),
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
    });

    const refreshed = await loadInstance(id, ctx.tenantId);
    if (!refreshed) throw notFound("Device not found.");
    return toDetailDTO(refreshed);
  },
};

export async function findInstanceById(id: string, tenantId: string): Promise<DeviceInstanceDTO | null> {
  const row = await loadInstance(id, tenantId);
  return row ? toDeviceInstanceDTO(row) : null;
}
