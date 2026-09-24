import type { ClinicSessionUser, PartnerContext, PartnerSessionUser, TenantContext } from "@/interfaces/session";
import type { PermissionSlug } from "@/interfaces/permissions";
import { CORRELATION_HEADER } from "@/constants/session";
import { forbidden, unauthorized } from "@/lib/errors";
import { newCorrelationId } from "@/lib/crypto";
import {
  cachedHasPermission,
  ensureRoleGrantCache,
} from "@/services/roles/roleGrantsService";
import { readSession } from "./session";

export { CORRELATION_HEADER };

function correlationIdFrom(req: Request): string {
  const incoming = req.headers.get(CORRELATION_HEADER);
  return incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : newCorrelationId();
}

/**
 * Section 16.1 / 32 — tenant context comes from the authenticated server
 * session, never from the request body. Every protected clinic route calls this first.
 * Rejects partner sessions.
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
  return { tenantId: clinicUser.tenantId, user: clinicUser, correlationId: correlationIdFrom(req) };
}

/** Partner organisation context — rejects clinic sessions. */
export async function requirePartnerContext(req: Request): Promise<PartnerContext> {
  const user = await readSession();
  if (!user || user.accountKind !== "partner" || !user.organisationId) {
    throw unauthorized();
  }
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
  };
}

/** True if the session role grants any of the listed slugs (DB-backed cache). */
export function requirePermission(ctx: TenantContext, ...slugs: PermissionSlug[]): void {
  if (!slugs.some((slug) => cachedHasPermission(ctx.user.role, slug))) throw forbidden();
}

/** @deprecated Prefer requirePermission — kept for rare role-only checks during migration. */
export function requireRole(ctx: TenantContext, ...roles: TenantContext["user"]["role"][]): void {
  if (!roles.includes(ctx.user.role)) throw forbidden();
}

/** For webhooks and other unauthenticated-but-trusted routes: still produce a correlation id. */
export function correlationFrom(req: Request): string {
  return correlationIdFrom(req);
}
