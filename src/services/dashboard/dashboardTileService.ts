import type { TenantContext } from "@/interfaces";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import type { SetRoleDashboardTilesInput } from "@/schemas/k10";
import { DASHBOARD_ROLE_LABELS } from "@/constants/dashboardTiles";
import { USER_ROLES } from "@/constants/roles";
import type { ClinicRole } from "@prisma/client";

export type ResolvedTile = {
  key: string;
  title: string;
  question: string;
  zone: "decides" | "worklist" | "watch";
  sortOrder: number;
  dutyKey: string | null;
  requiredPermission: PermissionSlug | null;
};

/**
 * Role-only tile assignment (K6).
 * Effective tiles = DashboardTileGrant for the user's ClinicRole,
 * filtered by requiredPermission. No per-user overrides.
 */
export const dashboardTileService = {
  async resolveForUser(ctx: TenantContext, userId?: string): Promise<ResolvedTile[]> {
    const targetUserId = userId ?? ctx.user.id;
    const user = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId: ctx.tenantId },
      select: { id: true, role: true },
    });
    if (!user?.role) throw notFound("User not found");
    return this.resolveForRole(ctx, user.role as UserRole);
  },

  async resolveForRole(ctx: TenantContext, role: UserRole): Promise<ResolvedTile[]> {
    const grants = await prisma.dashboardTileGrant.findMany({
      where: { role: role as ClinicRole },
      include: { tile: true },
    });
    const granted = new Set(ctx.permissions ?? []);
    const tiles = grants
      .map((g) => g.tile)
      .filter((t) => !t.requiredPermission || granted.has(t.requiredPermission as never));

    return tiles
      .map((t) => ({
        key: t.key,
        title: t.title,
        question: t.question,
        zone: t.zone,
        sortOrder: t.sortOrder,
        dutyKey: t.dutyKey,
        requiredPermission: (t.requiredPermission as PermissionSlug | null) ?? null,
      }))
      .sort((a, b) => a.zone.localeCompare(b.zone) || a.sortOrder - b.sortOrder);
  },

  async listCatalog(ctx: TenantContext) {
    requirePermission(ctx, "roles:view");
    return prisma.refDashboardTile.findMany({ orderBy: [{ zone: "asc" }, { sortOrder: "asc" }] });
  },

  async getRoleAssignment(ctx: TenantContext, role: UserRole) {
    requirePermission(ctx, "roles:view");
    if (!USER_ROLES.includes(role)) throw badRequest("Unknown role");
    const grants = await prisma.dashboardTileGrant.findMany({
      where: { role: role as ClinicRole },
      select: { tileKey: true },
      orderBy: { tileKey: "asc" },
    });
    return {
      role,
      roleLabel: DASHBOARD_ROLE_LABELS[role],
      tileKeys: grants.map((g) => g.tileKey),
    };
  },

  async setRoleTiles(ctx: TenantContext, input: SetRoleDashboardTilesInput) {
    requirePermission(ctx, "roles:update");
    if (!USER_ROLES.includes(input.role)) throw badRequest("Unknown role");

    const uniqueKeys = [...new Set(input.tileKeys)];
    if (uniqueKeys.length > 0) {
      const known = await prisma.refDashboardTile.findMany({
        where: { key: { in: uniqueKeys } },
        select: { key: true },
      });
      if (known.length !== uniqueKeys.length) throw badRequest("Unknown tile key");
    }

    await prisma.$transaction(async (tx) => {
      await tx.dashboardTileGrant.deleteMany({ where: { role: input.role as ClinicRole } });
      if (uniqueKeys.length > 0) {
        await tx.dashboardTileGrant.createMany({
          data: uniqueKeys.map((tileKey) => ({
            role: input.role as ClinicRole,
            tileKey,
          })),
        });
      }
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "DashboardTileGrant",
      resourceId: input.role,
      action: "assign",
      summary: `Assigned ${uniqueKeys.length} dashboard tiles to role ${input.role}`,
      after: { role: input.role, tileKeys: uniqueKeys },
    });

    return this.getRoleAssignment(ctx, input.role);
  },
};
