import { ZodError } from "zod";
import { logger } from "./logger";

/**
 * Section 24 — predictable HTTP status codes.
 * Route handlers translate these into JSON responses via `errorResponse`.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "bad_request", message, details);
export const unauthorized = (message = "Sign in required.") =>
  new AppError(401, "unauthorized", message);
export const forbidden = (message = "Not allowed.") => new AppError(403, "forbidden", message);
export const notFound = (message = "Not found.") => new AppError(404, "not_found", message);
export const conflict = (message: string, details?: unknown) =>
  new AppError(409, "conflict", message, details);
export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, "unprocessable", message, details);
export const rateLimited = (message = "Too many requests.") =>
  new AppError(429, "rate_limited", message);
export const downstreamUnavailable = (message = "A downstream system is temporarily unavailable.") =>
  new AppError(503, "downstream_unavailable", message);

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown; correlationId?: string };
}

/** Converts any thrown value into a safe JSON response. Never leaks stack traces. */
export function errorResponse(error: unknown, correlationId?: string): Response {
  if (error instanceof ZodError) {
    const details = error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    const body: ErrorBody = {
      error: { code: "validation_error", message: details[0]?.message ?? "Invalid payload.", details, correlationId },
    };
    return Response.json(body, { status: 400 });
  }
  if (error instanceof AppError) {
    const body: ErrorBody = {
      error: { code: error.code, message: error.message, details: error.details, correlationId },
    };
    return Response.json(body, { status: error.status });
  }
  logger.error("unhandled route error", { correlationId, error: error instanceof Error ? error.message : String(error) });
  const body: ErrorBody = {
    error: { code: "internal_error", message: "Something went wrong. Please try again.", correlationId },
  };
  return Response.json(body, { status: 500 });
}
