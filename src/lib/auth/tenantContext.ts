import type { TenantContext } from "@/interfaces/session";
import type { PermissionSlug } from "@/interfaces/permissions";
import { hasPermission } from "@/constants/permissions";
import { CORRELATION_HEADER } from "@/constants/session";
import { forbidden, unauthorized } from "@/lib/errors";
import { newCorrelationId } from "@/lib/crypto";
import { readSession } from "./session";

export { CORRELATION_HEADER };

/**
 * Section 16.1 / 32 — tenant context comes from the authenticated server
 * session, never from the request body. Every protected route calls this first.
 */
export async function requireTenantContext(req: Request): Promise<TenantContext> {
  const user = await readSession();
  if (!user) throw unauthorized();
  const incoming = req.headers.get(CORRELATION_HEADER);
  const correlationId = incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : newCorrelationId();
  return { tenantId: user.tenantId, user, correlationId };
}

/** True if the session role grants any of the listed slugs. */
export function requirePermission(ctx: TenantContext, ...slugs: PermissionSlug[]): void {
  if (!slugs.some((slug) => hasPermission(ctx.user.role, slug))) throw forbidden();
}

/** @deprecated Prefer requirePermission — kept for rare role-only checks during migration. */
export function requireRole(ctx: TenantContext, ...roles: TenantContext["user"]["role"][]): void {
  if (!roles.includes(ctx.user.role)) throw forbidden();
}

/** For webhooks and other unauthenticated-but-trusted routes: still produce a correlation id. */
export function correlationFrom(req: Request): string {
  const incoming = req.headers.get(CORRELATION_HEADER);
  return incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : newCorrelationId();
}
