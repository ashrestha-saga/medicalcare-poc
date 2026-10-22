/**
 * Static auth route helpers. Middleware / RouteGuard consume these.
 * Route group names like (auth)/(app) do not appear in these paths.
 */

import type { UserRole } from "@/interfaces/session";

export const AUTH_ROUTES = ["/login"] as const;

/** Capturer / scan home — role `user` without shell:nav. */
export const AUTH_HOME = "/";

/** Persona dashboard — default for clinic managers after sign-in. */
export const DASHBOARD_HOME = "/dashboard";

export const PARTNER_HOME = "/partner";

/** Roles that land on the dashboard instead of the scan home. */
const DASHBOARD_HOME_ROLES: readonly UserRole[] = [
  "superadmin",
  "device_admin",
  "security_officer",
];

/** Clinic post-login / session home by role. */
export function clinicHomePath(role: UserRole | string | null | undefined): string {
  if (role && (DASHBOARD_HOME_ROLES as readonly string[]).includes(role)) {
    return DASHBOARD_HOME;
  }
  return AUTH_HOME;
}

/**
 * Paths that skip route-level permission checks inside the authenticated shell.
 * Login is outside the shell; keep `/login` for edge middleware later.
 */
export const ALWAYS_ALLOW_PATHS = ["/login"] as const;

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isAlwaysAllowPath(pathname: string): boolean {
  return ALWAYS_ALLOW_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isPartnerAppPath(pathname: string): boolean {
  return pathname === PARTNER_HOME || pathname.startsWith(`${PARTNER_HOME}/`);
}
