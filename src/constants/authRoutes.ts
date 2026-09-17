/**
 * Static auth route helpers. Middleware / RouteGuard consume these.
 * Route group names like (auth)/(app) do not appear in these paths.
 */

export const AUTH_ROUTES = ["/login"] as const;

export const AUTH_HOME = "/";

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
