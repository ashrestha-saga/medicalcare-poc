import type { TenantContext, UserOptionDTO, UserOptionsQuery } from "@/interfaces";
import type { UserRole } from "@/interfaces/session";
import { USER_ROLES } from "@/constants/roles";
import { requirePermission } from "@/lib/auth/tenantContext";
import { prisma } from "@/lib/prisma";

function toOption(row: {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}): UserOptionDTO {
  const role = (USER_ROLES.includes(row.role as UserRole) ? row.role : "user") as UserRole;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role,
    active: row.active,
  };
}

/**
 * Modular tenant user picklist — filter by roles / active / search.
 * Allowed for inventory + inventarize flows (not full users:view admin).
 */
export const userOptionsService = {
  async list(ctx: TenantContext, query: UserOptionsQuery = {}): Promise<UserOptionDTO[]> {
    requirePermission(ctx, "inventory:view", "inventory:update", "requests:create");

    const roles =
      query.roles?.filter((r) => USER_ROLES.includes(r)) ??
      undefined;
    const needle = query.q?.trim();
    const activeFilter =
      query.active === undefined ? true : query.active === null ? undefined : query.active;

    const rows = await prisma.user.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(activeFilter !== undefined ? { active: activeFilter } : {}),
        ...(roles?.length ? { role: { in: roles } } : {}),
        ...(query.excludeIds?.length ? { id: { notIn: query.excludeIds } } : {}),
        ...(needle
          ? {
              OR: [{ name: { contains: needle } }, { email: { contains: needle } }],
            }
          : {}),
      },
      select: { id: true, name: true, email: true, role: true, active: true },
      orderBy: [{ name: "asc" }],
    });

    return rows.map(toOption);
  },

  /** Resolve a tenant user for inventarize/edit writes; returns null if missing/wrong tenant. */
  async resolveInTenant(
    tenantId: string,
    userId: string | null | undefined,
  ): Promise<{ id: string; name: string } | null> {
    if (!userId?.trim()) return null;
    const row = await prisma.user.findFirst({
      where: { id: userId.trim(), tenantId },
      select: { id: true, name: true },
    });
    return row;
  },
};
