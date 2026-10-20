import type { AdminUserDTO, TenantContext } from "@/interfaces";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { DEFAULT_USER_ROLE, USER_ROLES } from "@/constants/roles";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import type { CreateUserInput, UpdateUserInput } from "@/schemas/user";
import { changedFields, recordAudit } from "@/services/audit/auditService";
import {
  ensureRoleGrantCache,
  getCachedPermissions,
  getUserPermissionSnapshot,
  samePermissionSet,
  sanitizeClinicPermissions,
} from "@/services/roles/roleGrantsService";
import {
  parseInviteAreaIds,
  resolveAreaAssignmentInput,
  syncUserAreaAssignments,
} from "@/services/users/userAreaScope";
import type { Prisma } from "@prisma/client";

const clinicStaff = (tenantId: string) =>
  ({ tenantId, accountKind: "clinic" as const });

function clinicRoleSearch(needle: string): Prisma.UserWhereInput[] {
  const roles = USER_ROLES.filter((r) => r.includes(needle));
  return roles.length ? [{ role: { in: roles } }] : [];
}

function toAdminUserDTO(row: {
  id: string;
  email: string;
  name: string;
  role: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions?: PermissionSlug[] | null;
  status?: AdminUserDTO["status"];
  invitationId?: string | null;
  expiresAt?: string | null;
  homeAreaId?: string | null;
  areaIds?: string[];
}): AdminUserDTO {
  const role = (USER_ROLES.includes(row.role as UserRole) ? row.role : DEFAULT_USER_ROLE) as UserRole;
  const status =
    row.status ?? (row.active ? ("active" as const) : ("inactive" as const));
  const areaIds = [...new Set(row.areaIds ?? [])];
  const homeAreaId = row.homeAreaId ?? null;
  if (homeAreaId && !areaIds.includes(homeAreaId)) areaIds.unshift(homeAreaId);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role,
    active: row.active,
    status,
    permissions: row.permissions ?? null,
    homeAreaId,
    areaIds,
    invitationId: row.invitationId ?? null,
    expiresAt: row.expiresAt ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function areaIdsFromUser(row: {
  homeAreaId: string | null;
  areaAssignments?: { areaId: string }[];
}): string[] {
  const ids = new Set<string>();
  if (row.homeAreaId) ids.add(row.homeAreaId);
  for (const a of row.areaAssignments ?? []) ids.add(a.areaId);
  return [...ids];
}

function parseInvitePermissions(raw: Prisma.JsonValue | null | undefined): PermissionSlug[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const cleaned = sanitizeClinicPermissions(raw.map(String));
  return cleaned.length > 0 ? cleaned : null;
}

export const userAdminService = {
  async list(ctx: TenantContext, q?: string): Promise<AdminUserDTO[]> {
    requirePermission(ctx, "users:view");
    await ensureRoleGrantCache();
    const needle = q?.trim().toLowerCase();
    const rows = await prisma.user.findMany({
      where: {
        ...clinicStaff(ctx.tenantId),
        // Training staff subjects (ops.person) use staff-* emails — not login accounts.
        NOT: { email: { startsWith: "staff-" } },
        ...(needle
          ? {
              OR: [
                { email: { contains: needle } },
                { name: { contains: needle } },
                ...clinicRoleSearch(needle),
              ],
            }
          : {}),
      },
      include: {
        permissions: { select: { permission: true } },
        areaAssignments: { select: { areaId: true } },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    const users: AdminUserDTO[] = rows.map((row) => {
      const snap =
        row.permissions.length === 0
          ? null
          : sanitizeClinicPermissions(row.permissions.map((p) => p.permission));
      return toAdminUserDTO({
        ...row,
        permissions: snap,
        status: row.active ? "active" : "inactive",
        homeAreaId: row.homeAreaId,
        areaIds: areaIdsFromUser(row),
      });
    });

    const invites = await prisma.userInvitation.findMany({
      where: {
        tenantId: ctx.tenantId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
        ...(needle
          ? {
              OR: [
                { email: { contains: needle } },
                { name: { contains: needle } },
                { role: { contains: needle } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const invited: AdminUserDTO[] = invites.map((inv) => {
      const areaIds = parseInviteAreaIds(inv.areaIds);
      return toAdminUserDTO({
        id: `invite:${inv.id}`,
        email: inv.email,
        name: inv.name?.trim() || inv.email,
        role: inv.role,
        active: false,
        createdAt: inv.createdAt,
        updatedAt: inv.createdAt,
        status: "invited",
        permissions: parseInvitePermissions(inv.permissions),
        invitationId: inv.id,
        expiresAt: inv.expiresAt.toISOString(),
        homeAreaId: inv.homeAreaId,
        areaIds,
      });
    });

    return [...invited, ...users];
  },

  async get(ctx: TenantContext, id: string): Promise<AdminUserDTO> {
    requirePermission(ctx, "users:view");
    await ensureRoleGrantCache();

    if (id.startsWith("invite:")) {
      const invitationId = id.slice("invite:".length);
      const inv = await prisma.userInvitation.findFirst({
        where: {
          id: invitationId,
          tenantId: ctx.tenantId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!inv) throw notFound("Invitation not found.");
      const areaIds = parseInviteAreaIds(inv.areaIds);
      return toAdminUserDTO({
        id: `invite:${inv.id}`,
        email: inv.email,
        name: inv.name?.trim() || inv.email,
        role: inv.role,
        active: false,
        createdAt: inv.createdAt,
        updatedAt: inv.createdAt,
        status: "invited",
        permissions: parseInvitePermissions(inv.permissions),
        invitationId: inv.id,
        expiresAt: inv.expiresAt.toISOString(),
        homeAreaId: inv.homeAreaId,
        areaIds,
      });
    }

    const row = await prisma.user.findFirst({
      where: { id, ...clinicStaff(ctx.tenantId), NOT: { email: { startsWith: "staff-" } } },
      include: {
        permissions: { select: { permission: true } },
        areaAssignments: { select: { areaId: true } },
      },
    });
    if (!row) throw notFound("User not found.");
    const snap =
      row.permissions.length === 0
        ? null
        : sanitizeClinicPermissions(row.permissions.map((p) => p.permission));
    return toAdminUserDTO({
      ...row,
      permissions: snap,
      status: row.active ? "active" : "inactive",
      homeAreaId: row.homeAreaId,
      areaIds: areaIdsFromUser(row),
    });
  },

  async create(ctx: TenantContext, input: CreateUserInput): Promise<AdminUserDTO> {
    requirePermission(ctx, "users:create");
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existing) throw conflict("A user with this email already exists.");

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          ...clinicStaff(ctx.tenantId),
          email,
          name: input.name.trim(),
          role: input.role,
          passwordHash: hashPassword(input.password),
          active: input.active ?? true,
        },
      });
      await recordAudit(
        {
          actor: actorFromTenant(ctx),
          resource: "user",
          resourceId: created.id,
          action: "create",
          summary: `Created user ${created.email} (${created.role})`,
          after: { email: created.email, name: created.name, role: created.role, active: created.active },
          required: true,
        },
        tx,
      );
      return created;
    });
    return toAdminUserDTO({
      ...row,
      permissions: null,
      status: row.active ? "active" : "inactive",
      homeAreaId: row.homeAreaId,
      areaIds: areaIdsFromUser(row),
    });
  },

  async update(ctx: TenantContext, userId: string, input: UpdateUserInput): Promise<AdminUserDTO> {
    requirePermission(ctx, "users:update");
    await ensureRoleGrantCache();
    const row = await prisma.user.findFirst({
      where: { id: userId, ...clinicStaff(ctx.tenantId) },
      include: {
        permissions: { select: { permission: true } },
        areaAssignments: { select: { areaId: true } },
      },
    });
    if (!row) throw notFound("User not found.");

    if (row.id === ctx.user.id) {
      if (!input.active) throw unprocessable("You cannot deactivate your own account.");
      if (input.role !== row.role) throw unprocessable("You cannot change your own role.");
      if (input.permissions !== undefined) {
        throw unprocessable("You cannot change your own permissions.");
      }
      if (input.areaIds !== undefined || input.homeAreaId !== undefined) {
        throw unprocessable("You cannot change your own work areas.");
      }
    }

    let resolvedAreas: Awaited<ReturnType<typeof resolveAreaAssignmentInput>> | undefined;
    if (input.areaIds !== undefined || input.homeAreaId !== undefined) {
      const baseIds =
        input.areaIds ?? areaIdsFromUser(row);
      resolvedAreas = await resolveAreaAssignmentInput(ctx.tenantId, {
        areaIds: baseIds,
        homeAreaId: input.homeAreaId !== undefined ? input.homeAreaId : row.homeAreaId,
        role: input.role,
      });
    } else if (input.role === "user" && areaIdsFromUser(row).length === 0) {
      throw unprocessable("Assign at least one work area for role User.", { field: "areaIds" });
    }

    if (row.role === "superadmin" && input.role !== "superadmin") {
      const otherAdmins = await prisma.user.count({
        where: {
          ...clinicStaff(ctx.tenantId),
          role: "superadmin",
          active: true,
          id: { not: row.id },
        },
      });
      if (otherAdmins === 0) {
        throw unprocessable("Cannot remove the last active Superadmin.");
      }
    }

    if (row.role === "superadmin" && row.active && !input.active) {
      const otherAdmins = await prisma.user.count({
        where: {
          ...clinicStaff(ctx.tenantId),
          role: "superadmin",
          active: true,
          id: { not: row.id },
        },
      });
      if (otherAdmins === 0) {
        throw unprocessable("Cannot deactivate the last active Superadmin.");
      }
    }

    const previousPerms =
      row.permissions.length === 0
        ? null
        : sanitizeClinicPermissions(row.permissions.map((p) => p.permission));
    const previousEffective =
      previousPerms ?? [...getCachedPermissions((row.role as UserRole) || DEFAULT_USER_ROLE)];

    let nextSnapshot: PermissionSlug[] | null | undefined;
    if (input.permissions !== undefined) {
      const cleaned = sanitizeClinicPermissions(input.permissions);
      const preset = getCachedPermissions(input.role);
      nextSnapshot = samePermissionSet(cleaned, preset) ? null : cleaned;
    }

    const next = {
      name: input.name.trim(),
      role: input.role,
      active: input.active,
    };
    const diff = changedFields(
      { name: row.name, role: row.role, active: row.active },
      next,
    );
    const previousAreaIds = areaIdsFromUser(row);
    const updated = await prisma.$transaction(async (tx) => {
      const revoke =
        next.active !== row.active ||
        next.role !== row.role ||
        nextSnapshot !== undefined ||
        resolvedAreas !== undefined
          ? { sessionsValidFrom: new Date() }
          : {};
      const saved = await tx.user.update({
        where: { id: row.id },
        data: {
          name: next.name,
          role: next.role,
          accountKind: "clinic",
          tenantId: ctx.tenantId,
          active: next.active,
          ...revoke,
        },
      });

      if (nextSnapshot !== undefined) {
        await tx.userPermission.deleteMany({ where: { userId: row.id } });
        if (nextSnapshot && nextSnapshot.length > 0) {
          await tx.userPermission.createMany({
            data: nextSnapshot.map((permission) => ({
              userId: row.id,
              permission,
            })),
          });
        }
      }

      if (resolvedAreas) {
        await syncUserAreaAssignments(tx, {
          tenantId: ctx.tenantId,
          userId: row.id,
          homeAreaId: resolvedAreas.homeAreaId,
          areaIds: resolvedAreas.areaIds,
        });
      }

      const afterPerms =
        nextSnapshot === undefined
          ? previousEffective
          : nextSnapshot ?? [...getCachedPermissions(input.role)];
      const permChanged =
        nextSnapshot !== undefined &&
        !samePermissionSet(previousEffective, afterPerms);
      const areasChanged =
        resolvedAreas !== undefined &&
        (resolvedAreas.homeAreaId !== row.homeAreaId ||
          resolvedAreas.areaIds.length !== previousAreaIds.length ||
          resolvedAreas.areaIds.some((id) => !previousAreaIds.includes(id)));

      await recordAudit(
        {
          actor: actorFromTenant(ctx),
          resource: "user",
          resourceId: saved.id,
          action: "update",
          summary: `Updated user ${saved.email}`,
          before: {
            ...(diff?.before ?? {}),
            ...(permChanged ? { permissions: previousEffective } : {}),
            ...(areasChanged
              ? { homeAreaId: row.homeAreaId, areaIds: previousAreaIds }
              : {}),
          },
          after: {
            ...(diff?.after ?? {}),
            ...(permChanged ? { permissions: afterPerms } : {}),
            ...(areasChanged && resolvedAreas
              ? { homeAreaId: resolvedAreas.homeAreaId, areaIds: resolvedAreas.areaIds }
              : {}),
          },
          required: true,
        },
        tx,
      );
      return saved;
    });

    const snap =
      nextSnapshot !== undefined
        ? nextSnapshot
        : await getUserPermissionSnapshot(updated.id);
    const refreshed = await prisma.user.findFirst({
      where: { id: updated.id },
      include: { areaAssignments: { select: { areaId: true } } },
    });
    return toAdminUserDTO({
      ...updated,
      homeAreaId: refreshed?.homeAreaId ?? null,
      areaIds: refreshed ? areaIdsFromUser(refreshed) : [],
      permissions: snap,
      status: updated.active ? "active" : "inactive",
    });
  },

  async remove(ctx: TenantContext, userId: string): Promise<void> {
    requirePermission(ctx, "users:delete");
    if (userId === ctx.user.id) throw unprocessable("You cannot delete your own account.");

    const row = await prisma.user.findFirst({
      where: { id: userId, ...clinicStaff(ctx.tenantId) },
    });
    if (!row) throw notFound("User not found.");

    if (row.role === "superadmin" && row.active) {
      const otherAdmins = await prisma.user.count({
        where: {
          ...clinicStaff(ctx.tenantId),
          role: "superadmin",
          active: true,
          id: { not: row.id },
        },
      });
      if (otherAdmins === 0) {
        throw unprocessable("Cannot delete the last active Superadmin.");
      }
    }

    await prisma.$transaction(async (tx) => {
      await recordAudit(
        {
          actor: actorFromTenant(ctx),
          resource: "user",
          resourceId: row.id,
          action: "delete",
          summary: `Deleted user ${row.email}`,
          before: { email: row.email, name: row.name, role: row.role, active: row.active },
          required: true,
        },
        tx,
      );
      await tx.user.delete({ where: { id: row.id } });
    });
  },
};
