import type { PartnerContext } from "@/interfaces/session";
import type {
  TestEquipmentAssigneeOptionDTO,
  TestEquipmentClassDTO,
  TestEquipmentDTO,
  TestEquipmentListDTO,
} from "@/interfaces/pruefpartner";
import {
  TEST_EQUIPMENT_CLASS_META_BY_CODE,
  deriveTestEquipmentStatus,
  type TestEquipmentClassGroup,
} from "@/constants/testEquipmentClasses";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";
import { partnerHasConsolePermission } from "@/constants/partnerPermissions";

function toDto(row: {
  id: string;
  classCode: string;
  label: string;
  serialNumber: string | null;
  calibratedUntil: Date | null;
  traceabilityRef: string | null;
  active: boolean;
  assignedMembershipId: string | null;
  equipmentClass?: { label: string } | null;
  assignedMembership?: { user: { name: string } | null } | null;
}): TestEquipmentDTO {
  return {
    id: row.id,
    classCode: row.classCode,
    classLabel: row.equipmentClass?.label ?? null,
    label: row.label,
    serialNumber: row.serialNumber,
    calibratedUntil: row.calibratedUntil?.toISOString().slice(0, 10) ?? null,
    traceabilityRef: row.traceabilityRef,
    active: row.active,
    assignedMembershipId: row.assignedMembershipId,
    assigneeName: row.assignedMembership?.user?.name ?? null,
    status: deriveTestEquipmentStatus(row.active, row.calibratedUntil),
  };
}

function classGroup(code: string): TestEquipmentClassGroup {
  return TEST_EQUIPMENT_CLASS_META_BY_CODE.get(code)?.group ?? "general";
}

const listInclude = {
  equipmentClass: { select: { label: true } },
  assignedMembership: { select: { user: { select: { name: true } } } },
} as const;

export const testEquipmentService = {
  async listClasses(_ctx: PartnerContext): Promise<TestEquipmentClassDTO[]> {
    const rows = await prisma.refTestEquipmentClass.findMany({
      orderBy: { code: "asc" },
      select: { code: true, label: true },
    });
    const rank = new Map(
      [...TEST_EQUIPMENT_CLASS_META_BY_CODE.keys()].map((code, i) => [code, i]),
    );
    return rows
      .map((r) => ({
        code: r.code,
        label: r.label,
        group: classGroup(r.code),
      }))
      .sort((a, b) => {
        const ra = rank.get(a.code) ?? 999;
        const rb = rank.get(b.code) ?? 999;
        if (ra !== rb) return ra - rb;
        return a.label.localeCompare(b.label);
      });
  },

  async listAssignees(ctx: PartnerContext): Promise<TestEquipmentAssigneeOptionDTO[]> {
    const rows = await prisma.orgMembership.findMany({
      where: {
        organisationId: ctx.organisationId,
        OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
      },
      select: {
        id: true,
        appRole: true,
        user: { select: { name: true, active: true } },
      },
      orderBy: { user: { name: "asc" } },
    });
    return rows
      .filter((r) => r.user.active)
      .map((r) => ({
        membershipId: r.id,
        name: r.user.name,
        appRole: r.appRole,
      }));
  },

  async listBundle(ctx: PartnerContext, classCode?: string): Promise<TestEquipmentListDTO> {
    requirePartnerPermission(ctx, "testequipment:manage", "console:organisation:view");
    const canManage = partnerHasConsolePermission(ctx.user.appRole, "testequipment:manage");
    const [rows, classes, assignees] = await Promise.all([
      prisma.testEquipment.findMany({
        where: {
          organisationId: ctx.organisationId,
          ...(classCode ? { classCode } : {}),
        },
        include: listInclude,
        orderBy: [{ active: "desc" }, { classCode: "asc" }, { label: "asc" }],
      }),
      this.listClasses(ctx),
      canManage ? this.listAssignees(ctx) : Promise.resolve([]),
    ]);
    const items = rows.map(toDto);
    const summary = {
      total: items.length,
      active: items.filter((i) => i.active).length,
      due: items.filter((i) => i.status === "due").length,
      lapsed: items.filter((i) => i.status === "lapsed").length,
      inactive: items.filter((i) => i.status === "inactive").length,
    };
    return { items, classes, assignees, summary, canManage };
  },

  /** @deprecated Prefer listBundle — kept for narrow callers. */
  async list(ctx: PartnerContext, classCode?: string): Promise<TestEquipmentDTO[]> {
    const bundle = await this.listBundle(ctx, classCode);
    return bundle.items;
  },

  async get(ctx: PartnerContext, id: string): Promise<TestEquipmentDTO> {
    requirePartnerPermission(ctx, "testequipment:manage", "console:organisation:view");
    const row = await prisma.testEquipment.findFirst({
      where: { id, organisationId: ctx.organisationId },
      include: listInclude,
    });
    if (!row) throw notFound("Test equipment not found.");
    return toDto(row);
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
    const cls = await prisma.refTestEquipmentClass.findUnique({
      where: { code: input.classCode },
      select: { code: true },
    });
    if (!cls) throw notFound("Unknown equipment class.");
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
      include: listInclude,
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
      assignedMembershipId: string | null;
      classCode: string;
    }>,
  ): Promise<TestEquipmentDTO> {
    requirePartnerPermission(ctx, "testequipment:manage");
    const existing = await prisma.testEquipment.findFirst({
      where: { id, organisationId: ctx.organisationId },
    });
    if (!existing) throw notFound("Test equipment not found.");
    if (input.classCode) {
      const cls = await prisma.refTestEquipmentClass.findUnique({
        where: { code: input.classCode },
        select: { code: true },
      });
      if (!cls) throw notFound("Unknown equipment class.");
    }
    if (input.assignedMembershipId) {
      const membership = await prisma.orgMembership.findFirst({
        where: { id: input.assignedMembershipId, organisationId: ctx.organisationId },
        select: { id: true },
      });
      if (!membership) throw notFound("Membership not found.");
    }
    const row = await prisma.testEquipment.update({
      where: { id },
      data: {
        ...(input.classCode != null ? { classCode: input.classCode } : {}),
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
        ...(input.assignedMembershipId !== undefined
          ? { assignedMembershipId: input.assignedMembershipId }
          : {}),
      },
      include: listInclude,
    });
    return toDto(row);
  },
};
