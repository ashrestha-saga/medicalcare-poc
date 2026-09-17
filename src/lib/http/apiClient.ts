import { CORRELATION_HEADER } from "@/constants/session";

/**
 * Browser-side fetch helper. Adds the correlation id, parses the server's
 * error envelope, and distinguishes "offline / network" from HTTP errors so the
 * offline queue can decide what to do.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message = "No connection.") {
    super(message);
    this.name = "NetworkError";
  }
}

export function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function api<T>(path: string, init: RequestInit & { correlationId?: string } = {}): Promise<T> {
  const { correlationId, headers, ...rest } = init;
  const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: {
        ...(rest.body && !isFormData ? { "content-type": "application/json" } : {}),
        [CORRELATION_HEADER]: correlationId ?? newClientId(),
        ...(headers ?? {}),
      },
    });
  } catch {
    throw new NetworkError();
  }
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; details?: unknown; correlationId?: string } } | undefined)?.error;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status})`, err?.details, err?.correlationId);
  }
  return body as T;
}

export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
