/** Cookie name for the signed DeviceCare session (SEC-900). */
export const SESSION_COOKIE = "devicecare_session";

/** Session lifetime in seconds (12 hours). */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

/** Correlation id header forwarded on browser → API calls. */
export const CORRELATION_HEADER = "x-correlation-id";

/** Partner acting-tenant header. Revalidated against contract on every request. Never from the body. */
export const ACTING_TENANT_HEADER = "x-acting-tenant-id";
