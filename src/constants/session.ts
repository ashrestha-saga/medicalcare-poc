/** Cookie name for the signed DeviceCare session (SEC-900). */
export const SESSION_COOKIE = "devicecare_session";

/** Session lifetime in seconds (12 hours). */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

/** Correlation id header forwarded on browser → API calls. */
export const CORRELATION_HEADER = "x-correlation-id";
