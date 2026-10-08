import { ACTING_TENANT_HEADER, CORRELATION_HEADER } from "@/constants/session";
import { useActingTenantStore } from "@/store/actingTenantStore";

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

/**
 * When to attach x-acting-tenant-id.
 * On /partner pages, capabilities/menu must stay console:* — do not send the header
 * for those calls. Partner inspection-run APIs still need the clinic tenant.
 */
function resolveActingTenantId(apiPath: string): string | null {
  if (typeof window === "undefined") return null;
  const tenantId = useActingTenantStore.getState().tenantId;
  if (!tenantId) return null;
  const onPartnerConsole = window.location.pathname.startsWith("/partner");
  if (!onPartnerConsole) return tenantId;
  return apiPath.startsWith("/api/partner/inspection-runs") ? tenantId : null;
}

export async function api<T>(path: string, init: RequestInit & { correlationId?: string } = {}): Promise<T> {
  const { correlationId, headers, ...rest } = init;
  const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;
  const actingTenantId = resolveActingTenantId(path);
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: {
        ...(rest.body && !isFormData ? { "content-type": "application/json" } : {}),
        [CORRELATION_HEADER]: correlationId ?? newClientId(),
        ...(actingTenantId ? { [ACTING_TENANT_HEADER]: actingTenantId } : {}),
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
