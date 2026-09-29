import type { ActingContext, ClinicSessionUser, PartnerContext, PartnerSessionUser, TenantContext } from "@/interfaces/session";
import type { PermissionSlug } from "@/interfaces/permissions";
import { ACTING_TENANT_HEADER, CORRELATION_HEADER } from "@/constants/session";
import { intersectPartnerGrantsWithScope } from "@/constants/partnerPermissions";
import { forbidden, unauthorized } from "@/lib/errors";
import { newCorrelationId } from "@/lib/crypto";
import {
  cachedHasPermission,
  ensurePartnerRoleGrantCache,
  ensureRoleGrantCache,
  getCachedPartnerActingPermissions,
  getCachedPartnerConsolePermissions,
  getCachedPermissions,
  getEffectiveClinicPermissions,
} from "@/services/roles/roleGrantsService";
import { assertPartnerManagesTenant } from "@/services/access/partnerAccessService";
import { actorFromPartnerOnTenant, actorFromTenant, requestMetaFrom } from "./actorContext";
import { readSession } from "./session";
import { bindTenant, bindTenantBypass, runWithTenantAsync, runWithoutTenantAsync } from "./tenantStore";

export { CORRELATION_HEADER, ACTING_TENANT_HEADER, bindTenant, bindTenantBypass };

/**
 * Run work under a durable tenant ALS scope (`storage.run`).
 * Prefer this over `attachTenantStore` — Next.js often restores `enterWith` across awaits.
 */
export async function withTenantStore<T>(
  ctx: { tenantId: string },
  fn: () => Promise<T>,
): Promise<T> {
  return runWithTenantAsync(ctx.tenantId, fn);
}

/**
 * Partner org routes that fan out across tenants — durable bypass for the callback.
 */
export async function withTenantBypass<T>(fn: () => Promise<T>): Promise<T> {
  return runWithoutTenantAsync(fn);
}

/**
 * @deprecated Prefer `withTenantStore(ctx, async () => …)`.
 * `enterWith` does not reliably survive Next.js awaits (SEC-01).
 */
export function attachTenantStore(ctx: { tenantId: string }): void {
  bindTenant(ctx.tenantId);
}

/**
 * @deprecated Prefer `withTenantBypass(async () => …)`.
 */
export function attachTenantBypass(): void {
  bindTenantBypass();
}

function correlationIdFrom(req: Request): string {
  const incoming = req.headers.get(CORRELATION_HEADER);
  return incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : newCorrelationId();
}

function actingTenantIdFromHeader(req: Request): string | null {
  const raw = req.headers.get(ACTING_TENANT_HEADER)?.trim() ?? "";
  if (!raw || raw.length > 191) return null;
  return raw;
}

/**
 * Section 16.1 / 32 — tenant context comes from the authenticated server
 * session, never from the request body. Every reserved clinic route calls this first.
 * Rejects partner sessions. Binds AsyncLocalStorage for SEC-01 Prisma guard.
 */
export async function requireTenantContext(req: Request): Promise<TenantContext> {
  const user = await readSession();
  if (!user || user.accountKind === "partner" || !user.tenantId || !user.role) {
    throw unauthorized();
  }
  await ensureRoleGrantCache();
  const clinicUser: ClinicSessionUser = {
    ...user,
    accountKind: "clinic",
    tenantId: user.tenantId,
    role: user.role,
  };
  const permissions = await getEffectiveClinicPermissions(clinicUser.id, clinicUser.role);
  const base = {
    tenantId: clinicUser.tenantId,
    user: clinicUser,
    correlationId: correlationIdFrom(req),
    requestMeta: requestMetaFrom(req),
  };
  // Note: enterWith/bindTenant does not stick across Next.js awaits — wrap the
  // handler body in `withTenantStore(ctx, …)` (or `withTenantBypass`).
  return {
    ...base,
    permissions,
    actor: actorFromTenant(base),
  };
}

/** @deprecated Alias of `withTenantStore` — prefer that name in new code. */
export async function withTenantContext<T>(ctx: { tenantId: string }, fn: () => Promise<T>): Promise<T> {
  return withTenantStore(ctx, fn);
}

/** Partner organisation context — rejects clinic sessions. */
export async function requirePartnerContext(req: Request): Promise<PartnerContext> {
  const user = await readSession();
  if (!user || user.accountKind !== "partner" || !user.organisationId) {
    throw unauthorized();
  }
  await ensurePartnerRoleGrantCache();
  const partnerUser: PartnerSessionUser = {
    ...user,
    accountKind: "partner",
    organisationId: user.organisationId,
    organisationName: user.organisationName ?? "",
    appRole: user.appRole ?? "inspector",
  };
  return {
    organisationId: partnerUser.organisationId,
    user: partnerUser,
    correlationId: correlationIdFrom(req),
    requestMeta: requestMetaFrom(req),
  };
}

/** Console RBAC — partner must hold at least one of the listed console:* slugs (DB-backed). */
export function requirePartnerPermission(ctx: PartnerContext, ...slugs: PermissionSlug[]): void {
  const granted = getCachedPartnerConsolePermissions(ctx.user.appRole);
  if (!slugs.some((slug) => granted.includes(slug))) throw forbidden();
}

/**
 * Shared clinic APIs. Clinic tenant comes from the session.
 * Partner tenant comes only from X-Acting-Tenant-Id and is re-checked every request.
 */
export async function requireActingContext(req: Request): Promise<ActingContext> {
  const user = await readSession();
  if (!user) throw unauthorized();

  if (user.accountKind !== "partner") {
    const clinic = await requireTenantContext(req);
    return {
      ...clinic,
      permissions: clinic.permissions ?? [],
      actor: clinic.actor ?? actorFromTenant(clinic),
    };
  }

  if (!user.organisationId) throw unauthorized();
  const tenantId = actingTenantIdFromHeader(req);
  if (!tenantId) throw forbidden();

  const partner = await requirePartnerContext(req);
  const access = await assertPartnerManagesTenant(partner.user.id, partner.organisationId, tenantId);
  const permissions = intersectPartnerGrantsWithScope(
    getCachedPartnerActingPermissions(access.appRole),
    access.scope,
  );
  // Partner door: caller must wrap with `withTenantStore(ctx, …)` (enterWith caveat).
  return {
    tenantId,
    user: { ...partner.user, organisationName: access.organisationName },
    correlationId: partner.correlationId,
    requestMeta: partner.requestMeta,
    permissions,
    actor: actorFromPartnerOnTenant(partner, tenantId, access.contractId, req),
  };
}

type PermissionHolder = { permissions?: readonly PermissionSlug[]; user?: { accountKind?: string; role?: TenantContext["user"]["role"] } };

/** True if the resolved grant list contains any of the listed slugs. */
export function requirePermission(ctx: PermissionHolder, ...slugs: PermissionSlug[]): void {
  const granted = resolvePermissions(ctx);
  if (!slugs.some((slug) => granted.includes(slug))) throw forbidden();
}

function resolvePermissions(ctx: PermissionHolder): readonly PermissionSlug[] {
  if (ctx.permissions) return ctx.permissions;
  if (ctx.user?.accountKind !== "partner" && ctx.user?.role) {
    return getCachedPermissions(ctx.user.role);
  }
  return [];
}

/** @deprecated Prefer requirePermission — kept for rare role-only checks during migration. */
export function requireRole(ctx: TenantContext, ...roles: TenantContext["user"]["role"][]): void {
  if (!roles.includes(ctx.user.role)) throw forbidden();
}

/** For webhooks and other unauthenticated-but-trusted routes: still produce a correlation id. */
export function correlationFrom(req: Request): string {
  return correlationIdFrom(req);
}

export { cachedHasPermission };
