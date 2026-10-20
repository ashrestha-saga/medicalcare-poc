import type { TenantWorkContext } from "@/interfaces";
import type { UserRole } from "@/interfaces/session";
import { forbidden, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Minimal ctx for area helpers — clinic TenantContext or partner-on-tenant. */
type AreaScopeCtx = Pick<TenantWorkContext, "tenantId" | "user">;

/** Roles that see all tenant locations (no area filter). */
export const AREA_UNSCOPED_ROLES: readonly UserRole[] = [
  "superadmin",
  "device_admin",
  "security_officer",
];

export type ResolvedAreaAssignment = {
  homeAreaId: string | null;
  areaIds: string[];
};

/**
 * Validate area ids belong to the tenant and normalize primary home.
 * For role `user`, at least one area is required.
 */
export async function resolveAreaAssignmentInput(
  tenantId: string,
  opts: {
    areaIds?: string[] | null;
    homeAreaId?: string | null;
    role: UserRole;
  },
): Promise<ResolvedAreaAssignment> {
  const unique = [...new Set((opts.areaIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const home = opts.homeAreaId?.trim() || null;

  if (opts.role === "user" && unique.length === 0) {
    throw unprocessable("Assign at least one work area for role User.", { field: "areaIds" });
  }

  if (unique.length === 0) {
    return { homeAreaId: null, areaIds: [] };
  }

  const areas = await prisma.area.findMany({
    where: { tenantId, id: { in: unique } },
    select: { id: true },
  });
  if (areas.length !== unique.length) {
    throw unprocessable("One or more areas do not belong to this tenant.", { field: "areaIds" });
  }

  const homeAreaId = home && unique.includes(home) ? home : unique[0]!;
  return { homeAreaId, areaIds: unique };
}

/** Replace UserAreaAssignment rows and set User.homeAreaId (same transaction). */
export async function syncUserAreaAssignments(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    userId: string;
    homeAreaId: string | null;
    areaIds: string[];
  },
): Promise<void> {
  await tx.userAreaAssignment.deleteMany({ where: { userId: args.userId } });
  const today = new Date();
  const validFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (args.areaIds.length > 0) {
    await tx.userAreaAssignment.createMany({
      data: args.areaIds.map((areaId) => ({
        tenantId: args.tenantId,
        userId: args.userId,
        areaId,
        validFrom,
      })),
    });
  }
  await tx.user.update({
    where: { id: args.userId },
    data: { homeAreaId: args.homeAreaId },
  });
}

export type EffectiveAreaScope =
  | { mode: "all" }
  | { mode: "none" }
  | { mode: "areas"; areaIds: string[] };

/**
 * Work-area scope for inventory / Scan / reprocessing filters.
 * Unscoped roles and partner-on-tenant see the whole tenant; others use home ∪ open assignments.
 */
export async function getEffectiveAreaScope(ctx: AreaScopeCtx): Promise<EffectiveAreaScope> {
  if (ctx.user.accountKind === "partner") {
    return { mode: "all" };
  }
  const role = ctx.user.role as UserRole | null;
  if (role && (AREA_UNSCOPED_ROLES as readonly string[]).includes(role)) {
    return { mode: "all" };
  }

  const row = await prisma.user.findFirst({
    where: { id: ctx.user.id, tenantId: ctx.tenantId },
    select: {
      homeAreaId: true,
      areaAssignments: {
        where: {
          OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
        },
        select: { areaId: true },
      },
    },
  });

  const ids = new Set<string>();
  if (row?.homeAreaId) ids.add(row.homeAreaId);
  for (const a of row?.areaAssignments ?? []) ids.add(a.areaId);

  if (ids.size === 0) return { mode: "none" };
  return { mode: "areas", areaIds: [...ids] };
}

/** Convenience: area id list for Prisma `areaId: { in }` filters, or null = no filter. */
export async function getEffectiveAreaIds(ctx: AreaScopeCtx): Promise<string[] | null> {
  const scope = await getEffectiveAreaScope(ctx);
  if (scope.mode === "all") return null;
  if (scope.mode === "none") return [];
  return scope.areaIds;
}

/** Assigned areas ignoring role bypass (for “meine Geräte” tiles on admin roles). */
export async function getAssignedAreaIds(ctx: AreaScopeCtx): Promise<string[]> {
  if (ctx.user.accountKind === "partner") return [];
  const row = await prisma.user.findFirst({
    where: { id: ctx.user.id, tenantId: ctx.tenantId },
    select: {
      homeAreaId: true,
      areaAssignments: {
        where: {
          OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
        },
        select: { areaId: true },
      },
    },
  });
  const ids = new Set<string>();
  if (row?.homeAreaId) ids.add(row.homeAreaId);
  for (const a of row?.areaAssignments ?? []) ids.add(a.areaId);
  return [...ids];
}

/** Prisma fragment for DeviceInstance.areaId under effective scope. */
export function deviceAreaWhere(
  scope: EffectiveAreaScope,
): Prisma.DeviceInstanceWhereInput | "empty" | null {
  if (scope.mode === "all") return null;
  if (scope.mode === "none") return "empty";
  return { areaId: { in: scope.areaIds } };
}

export function isAreaInScope(scope: EffectiveAreaScope, areaId: string | null | undefined): boolean {
  if (scope.mode === "all") return true;
  if (scope.mode === "none") return false;
  return Boolean(areaId && scope.areaIds.includes(areaId));
}

/** Throw 403 if the device’s area is outside the caller’s work areas. */
export async function assertDeviceInWorkAreas(
  ctx: AreaScopeCtx,
  areaId: string | null | undefined,
): Promise<void> {
  const scope = await getEffectiveAreaScope(ctx);
  if (!isAreaInScope(scope, areaId)) {
    throw forbidden("This device is outside your assigned work areas.");
  }
}

/**
 * Sites that contain at least one effective work area.
 * `null` = unscoped (all sites); `[]` = no access.
 */
export async function getEffectiveSiteIds(ctx: AreaScopeCtx): Promise<string[] | null> {
  const scope = await getEffectiveAreaScope(ctx);
  if (scope.mode === "all") return null;
  if (scope.mode === "none") return [];
  const areas = await prisma.area.findMany({
    where: { tenantId: ctx.tenantId, id: { in: scope.areaIds } },
    select: { siteId: true },
  });
  return [...new Set(areas.map((a) => a.siteId))];
}

/** Throw 403 if the site is outside the caller’s work-area sites. */
export async function assertSiteInWorkAreas(
  ctx: AreaScopeCtx,
  siteId: string | null | undefined,
): Promise<void> {
  const sites = await getEffectiveSiteIds(ctx);
  if (sites === null) return;
  if (!siteId || !sites.includes(siteId)) {
    throw forbidden("This site is outside your assigned work areas.");
  }
}

export function parseInviteAreaIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(String).map((s) => s.trim()).filter(Boolean))];
}
