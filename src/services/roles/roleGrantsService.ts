import type { RoleCatalogEntry, TenantContext } from "@/interfaces";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { PartnerAppRole } from "@/interfaces/management";
import type { UserRole } from "@/interfaces/session";
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  SUPERADMIN_LOCKED_PERMISSIONS,
} from "@/constants/permissions";
import {
  CONSOLE_ROLE_PERMISSIONS,
  PARTNER_ROLE_PERMISSIONS,
} from "@/constants/partnerPermissions";
import { ROLES, USER_ROLES } from "@/constants/roles";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { recordAudit } from "@/services/audit/auditService";
import { unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { PrismaClient, RoleGrantKind } from "@prisma/client";

const ALL_SET = new Set<string>(ALL_PERMISSIONS);
const PARTNER_APP_ROLES: readonly PartnerAppRole[] = ["admin", "inspector", "order"];

const CLINIC_KIND = "clinic" as const satisfies RoleGrantKind;
const CONSOLE_KIND = "partner_console" as const satisfies RoleGrantKind;
const ACTING_KIND = "partner_acting" as const satisfies RoleGrantKind;

let clinicCache: Map<UserRole, readonly PermissionSlug[]> | null = null;
let partnerConsoleCache: Map<PartnerAppRole, readonly PermissionSlug[]> | null = null;
let partnerActingCache: Map<PartnerAppRole, readonly PermissionSlug[]> | null = null;

function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

function isPartnerAppRole(value: string): value is PartnerAppRole {
  return PARTNER_APP_ROLES.includes(value as PartnerAppRole);
}

function clinicDefaultRows(): { kind: RoleGrantKind; role: string; permission: string }[] {
  const rows: { kind: RoleGrantKind; role: string; permission: string }[] = [];
  for (const role of USER_ROLES) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      rows.push({ kind: CLINIC_KIND, role, permission });
    }
  }
  return rows;
}

function partnerDefaultRows(): { kind: RoleGrantKind; role: string; permission: string }[] {
  const rows: { kind: RoleGrantKind; role: string; permission: string }[] = [];
  for (const role of PARTNER_APP_ROLES) {
    for (const permission of CONSOLE_ROLE_PERMISSIONS[role]) {
      rows.push({ kind: CONSOLE_KIND, role, permission });
    }
    for (const permission of PARTNER_ROLE_PERMISSIONS[role]) {
      rows.push({ kind: ACTING_KIND, role, permission });
    }
  }
  return rows;
}

/** Insert clinic RoleGrant rows when none exist for kind=clinic. */
export async function seedRoleGrantsIfEmpty(client: PrismaClient = prisma): Promise<number> {
  const clinicCount = await client.roleGrant.count({ where: { kind: CLINIC_KIND } });
  if (clinicCount > 0) {
    await ensureDefaultPermissionGrants(client);
    await ensurePartnerRoleGrants(client);
    return 0;
  }
  const data = clinicDefaultRows();
  if (data.length === 0) return 0;
  await client.roleGrant.createMany({ data });
  await ensurePartnerRoleGrants(client);
  return data.length;
}

/** Add newly introduced clinic default slugs without wiping custom RoleGrant rows. */
export async function ensureDefaultPermissionGrants(client: PrismaClient = prisma): Promise<void> {
  const data = clinicDefaultRows();
  if (data.length === 0) return;
  await client.roleGrant.createMany({ data, skipDuplicates: true });
}

/** Seed partner_console + partner_acting defaults (skipDuplicates — never overwrite custom). */
export async function ensurePartnerRoleGrants(client: PrismaClient = prisma): Promise<void> {
  const data = partnerDefaultRows();
  if (data.length === 0) return;
  await client.roleGrant.createMany({ data, skipDuplicates: true });
}

async function loadClinicCacheFromDb(): Promise<Map<UserRole, readonly PermissionSlug[]>> {
  await seedRoleGrantsIfEmpty();
  const rows = await prisma.roleGrant.findMany({
    where: { kind: CLINIC_KIND },
    select: { role: true, permission: true },
  });
  const next = new Map<UserRole, PermissionSlug[]>();
  for (const role of USER_ROLES) next.set(role, []);
  for (const row of rows) {
    if (!isUserRole(row.role)) continue;
    if (!ALL_SET.has(row.permission)) continue;
    next.get(row.role)!.push(row.permission as PermissionSlug);
  }
  for (const role of USER_ROLES) {
    if ((next.get(role) ?? []).length === 0) {
      next.set(role, [...ROLE_PERMISSIONS[role]]);
    }
  }
  return next;
}

async function loadPartnerCachesFromDb(): Promise<{
  console: Map<PartnerAppRole, readonly PermissionSlug[]>;
  acting: Map<PartnerAppRole, readonly PermissionSlug[]>;
}> {
  await ensurePartnerRoleGrants();
  const rows = await prisma.roleGrant.findMany({
    where: { kind: { in: [CONSOLE_KIND, ACTING_KIND] } },
    select: { kind: true, role: true, permission: true },
  });
  const consoleMap = new Map<PartnerAppRole, PermissionSlug[]>();
  const actingMap = new Map<PartnerAppRole, PermissionSlug[]>();
  for (const role of PARTNER_APP_ROLES) {
    consoleMap.set(role, []);
    actingMap.set(role, []);
  }
  for (const row of rows) {
    if (!isPartnerAppRole(row.role)) continue;
    const slug = row.permission as PermissionSlug;
    if (row.kind === CONSOLE_KIND) consoleMap.get(row.role)!.push(slug);
    if (row.kind === ACTING_KIND) actingMap.get(row.role)!.push(slug);
  }
  for (const role of PARTNER_APP_ROLES) {
    if ((consoleMap.get(role) ?? []).length === 0) {
      consoleMap.set(role, [...CONSOLE_ROLE_PERMISSIONS[role]]);
    }
    if ((actingMap.get(role) ?? []).length === 0) {
      actingMap.set(role, [...PARTNER_ROLE_PERMISSIONS[role]]);
    }
  }
  return { console: consoleMap, acting: actingMap };
}

export function invalidateRoleGrantCache(): void {
  clinicCache = null;
  partnerConsoleCache = null;
  partnerActingCache = null;
}

/** Ensure in-memory clinic grants are loaded (call from requireTenantContext). */
export async function ensureRoleGrantCache(): Promise<void> {
  if (clinicCache) return;
  clinicCache = await loadClinicCacheFromDb();
}

/** Ensure partner console + acting grant caches (call from requirePartnerContext). */
export async function ensurePartnerRoleGrantCache(): Promise<void> {
  if (partnerConsoleCache && partnerActingCache) return;
  const loaded = await loadPartnerCachesFromDb();
  partnerConsoleCache = loaded.console;
  partnerActingCache = loaded.acting;
}

export function getCachedPermissions(role: UserRole): readonly PermissionSlug[] {
  if (clinicCache?.has(role)) return clinicCache.get(role)!;
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.user;
}

export function cachedHasPermission(role: UserRole, slug: PermissionSlug): boolean {
  return getCachedPermissions(role).includes(slug);
}

/**
 * Effective clinic grants for a user.
 * Zero UserPermission rows ⇒ RoleGrant preset for `role`.
 * Any rows ⇒ those rows are the full effective set (snapshot).
 */
export async function getEffectiveClinicPermissions(
  userId: string,
  role: UserRole,
): Promise<PermissionSlug[]> {
  await ensureRoleGrantCache();
  const rows = await prisma.userPermission.findMany({
    where: { userId },
    select: { permission: true },
  });
  if (rows.length === 0) return [...getCachedPermissions(role)];
  return rows
    .map((r) => r.permission)
    .filter((p): p is PermissionSlug => ALL_SET.has(p));
}

/** Raw UserPermission slugs, or null when the user follows the role preset. */
export async function getUserPermissionSnapshot(userId: string): Promise<PermissionSlug[] | null> {
  const rows = await prisma.userPermission.findMany({
    where: { userId },
    select: { permission: true },
  });
  if (rows.length === 0) return null;
  return rows
    .map((r) => r.permission)
    .filter((p): p is PermissionSlug => ALL_SET.has(p));
}

export function samePermissionSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((p) => set.has(p));
}

/** Keep only known clinic permission slugs (deduped). */
export function sanitizeClinicPermissions(slugs: readonly string[]): PermissionSlug[] {
  return [...new Set(slugs.filter((p): p is PermissionSlug => ALL_SET.has(p)))];
}

function normalizePartnerRole(appRole: PartnerAppRole | string): PartnerAppRole {
  return isPartnerAppRole(appRole) ? appRole : "inspector";
}

/** Console:* grants from DB (fallback: static CONSOLE_ROLE_PERMISSIONS). */
export function getCachedPartnerConsolePermissions(
  appRole: PartnerAppRole | string,
): readonly PermissionSlug[] {
  const role = normalizePartnerRole(appRole);
  if (partnerConsoleCache?.has(role)) return partnerConsoleCache.get(role)!;
  return CONSOLE_ROLE_PERMISSIONS[role];
}

/** Acting baseline grants from DB (fallback: static PARTNER_ROLE_PERMISSIONS). */
export function getCachedPartnerActingPermissions(
  appRole: PartnerAppRole | string,
): readonly PermissionSlug[] {
  const role = normalizePartnerRole(appRole);
  if (partnerActingCache?.has(role)) return partnerActingCache.get(role)!;
  return PARTNER_ROLE_PERMISSIONS[role];
}

export const roleGrantsService = {
  async listCatalog(ctx: TenantContext): Promise<RoleCatalogEntry[]> {
    requirePermission(ctx, "roles:view");
    await ensureRoleGrantCache();

    const counts = await prisma.user.groupBy({
      by: ["role"],
      where: { tenantId: ctx.tenantId, accountKind: "clinic", role: { not: null } },
      _count: { _all: true },
    });
    const countByRole = new Map(
      counts
        .filter((c): c is typeof c & { role: string } => c.role != null)
        .map((c) => [c.role, c._count._all]),
    );

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
      ...new Set(permissions.filter((p): p is PermissionSlug => ALL_SET.has(p))),
    ];

    if (role === "superadmin") {
      for (const locked of SUPERADMIN_LOCKED_PERMISSIONS) {
        if (!cleaned.includes(locked)) cleaned.push(locked);
      }
    }

    if (cleaned.length === 0) {
      throw unprocessable("A role must keep at least one permission.", { field: "permissions" });
    }

    const previous = [...getCachedPermissions(role)];
    await prisma.$transaction(async (tx) => {
      await tx.roleGrant.deleteMany({ where: { kind: CLINIC_KIND, role } });
      await tx.roleGrant.createMany({
        data: cleaned.map((permission) => ({ kind: CLINIC_KIND, role, permission })),
      });
      await recordAudit(
        {
          actor: actorFromTenant(ctx),
          resource: "role",
          resourceId: role,
          action: "grant",
          summary: `Updated permissions for role ${role}`,
          before: { permissions: previous },
          after: { permissions: cleaned },
          required: true,
        },
        tx,
      );
    });

    invalidateRoleGrantCache();
    await ensureRoleGrantCache();

    const counts = await prisma.user.count({
      where: { tenantId: ctx.tenantId, accountKind: "clinic", role },
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
