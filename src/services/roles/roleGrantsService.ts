import type { RoleCatalogEntry, TenantContext } from "@/interfaces";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  SUPERADMIN_LOCKED_PERMISSIONS,
} from "@/constants/permissions";
import { ROLES, USER_ROLES } from "@/constants/roles";
import { requirePermission } from "@/lib/auth/tenantContext";
import { unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";

const ALL_SET = new Set<string>(ALL_PERMISSIONS);

let cache: Map<UserRole, readonly PermissionSlug[]> | null = null;

/** RoleGrant delegate — cast keeps editors happy when Prisma Client types lag generate. */
type RoleGrantStore = {
  count: () => Promise<number>;
  createMany: (args: { data: { role: string; permission: string }[] }) => Promise<unknown>;
  findMany: (args: {
    select: { role: true; permission: true };
  }) => Promise<{ role: string; permission: string }[]>;
  deleteMany: (args: { where: { role: string } }) => Promise<unknown>;
};

function roleGrantStore(client: object = prisma): RoleGrantStore {
  return (client as unknown as { roleGrant: RoleGrantStore }).roleGrant;
}

function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

function defaultRows(): { role: string; permission: string }[] {
  const rows: { role: string; permission: string }[] = [];
  for (const role of USER_ROLES) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      rows.push({ role, permission });
    }
  }
  return rows;
}

/** Insert default RoleGrant rows when the table is empty. */
export async function seedRoleGrantsIfEmpty(client: PrismaClient = prisma): Promise<number> {
  const grants = roleGrantStore(client);
  const count = await grants.count();
  if (count > 0) return 0;
  const data = defaultRows();
  if (data.length === 0) return 0;
  await grants.createMany({ data });
  return data.length;
}

async function loadCacheFromDb(): Promise<Map<UserRole, readonly PermissionSlug[]>> {
  await seedRoleGrantsIfEmpty();
  const rows = await roleGrantStore().findMany({ select: { role: true, permission: true } });
  const next = new Map<UserRole, PermissionSlug[]>();
  for (const role of USER_ROLES) next.set(role, []);
  for (const row of rows) {
    if (!isUserRole(row.role)) continue;
    if (!ALL_SET.has(row.permission)) continue;
    next.get(row.role)!.push(row.permission as PermissionSlug);
  }
  // Fallback for any role with zero rows
  for (const role of USER_ROLES) {
    if ((next.get(role) ?? []).length === 0) {
      next.set(role, [...ROLE_PERMISSIONS[role]]);
    }
  }
  return next;
}

export function invalidateRoleGrantCache(): void {
  cache = null;
}

/** Ensure in-memory grants are loaded (call from requireTenantContext). */
export async function ensureRoleGrantCache(): Promise<void> {
  if (cache) return;
  cache = await loadCacheFromDb();
}

export function getCachedPermissions(role: UserRole): readonly PermissionSlug[] {
  if (cache?.has(role)) return cache.get(role)!;
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.user;
}

export function cachedHasPermission(role: UserRole, slug: PermissionSlug): boolean {
  return getCachedPermissions(role).includes(slug);
}

export const roleGrantsService = {
  async listCatalog(ctx: TenantContext): Promise<RoleCatalogEntry[]> {
    requirePermission(ctx, "roles:view");
    await ensureRoleGrantCache();

    const counts = await prisma.user.groupBy({
      by: ["role"],
      where: { tenantId: ctx.tenantId },
      _count: { _all: true },
    });
    const countByRole = new Map(counts.map((c) => [c.role, c._count._all]));

    return ROLES.map((r) => ({
      value: r.value,
      label: r.label,
      permissions: [...getCachedPermissions(r.value)],
      userCount: countByRole.get(r.value) ?? 0,
    }));
  },

  async listAllPermissionSlugs(ctx: TenantContext): Promise<PermissionSlug[]> {
    requirePermission(ctx, "roles:view");
    return [...ALL_PERMISSIONS];
  },

  async updateRole(
    ctx: TenantContext,
    role: UserRole,
    permissions: string[],
  ): Promise<RoleCatalogEntry> {
    requirePermission(ctx, "roles:update");

    const cleaned = [
      ...new Set(
        permissions.filter((p): p is PermissionSlug => ALL_SET.has(p)),
      ),
    ];

    if (role === "superadmin") {
      for (const locked of SUPERADMIN_LOCKED_PERMISSIONS) {
        if (!cleaned.includes(locked)) cleaned.push(locked);
      }
    }

    if (cleaned.length === 0) {
      throw unprocessable("A role must keep at least one permission.", { field: "permissions" });
    }

    await prisma.$transaction(async (tx) => {
      const grants = roleGrantStore(tx);
      await grants.deleteMany({ where: { role } });
      await grants.createMany({
        data: cleaned.map((permission) => ({ role, permission })),
      });
    });

    invalidateRoleGrantCache();
    await ensureRoleGrantCache();

    const counts = await prisma.user.count({
      where: { tenantId: ctx.tenantId, role },
    });
    const label = ROLES.find((r) => r.value === role)?.label ?? role;
    return {
      value: role,
      label,
      permissions: [...getCachedPermissions(role)],
      userCount: counts,
    };
  },
};
