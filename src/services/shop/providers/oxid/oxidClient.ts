import { fetchWithTimeout } from "@/lib/http";
import { ShopError } from "@/services/shop/types";
import { extractCheckoutError } from "@/services/shop/providers/oxid/oxidParsers";

function redact(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const copy = { ...(body as Record<string, unknown>) };
  for (const key of ["password", "client_secret", "code", "code_verifier", "refresh_token", "token", "pin"]) {
    if (key in copy) copy[key] = "***";
  }
  return copy;
}

export async function oxidRequest(input: {
  url: string;
  method: "GET" | "POST";
  token?: string;
  encoding?: "json" | "form";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}): Promise<{ status: number; data: unknown; raw: string }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    ...(input.headers ?? {}),
  };
  if (input.token) headers.Authorization = `Bearer ${input.token}`;

  let body: string | undefined;
  if (input.method === "POST") {
    const encoding = input.encoding ?? "json";
    headers["Content-Type"] =
      encoding === "form" ? "application/x-www-form-urlencoded" : "application/json";
    body =
      encoding === "form"
        ? new URLSearchParams(
            Object.entries((input.body ?? {}) as Record<string, string>).map(([k, v]) => [k, String(v)]),
          ).toString()
        : JSON.stringify(input.body ?? {});
  }

  void redact(input.body);

  let res: Response;
  try {
    res = await fetchWithTimeout(input.url, {
      method: input.method,
      headers,
      body,
      timeoutMs: input.timeoutMs ?? 15000,
      cache: "no-store",
    });
  } catch (error) {
    throw new ShopError(
      "UNAVAILABLE",
      error instanceof Error ? error.message : "Shop request failed",
      502,
    );
  }

  const raw = await res.text();
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data, raw };
}

export function mapShopHttpError(status: number, data: unknown, fallback: string): ShopError {
  const { code, message } = extractCheckoutError(data, fallback);
  if (status === 401) return new ShopError("UNAUTHORIZED", message, 401, data);
  if (code === "PIN_NOT_FOUND" || code === "INVALID_PIN") return new ShopError("PIN_INVALID", message, 422, data);
  if (code === "BELOW_MIN_ORDER_VALUE") return new ShopError("BELOW_MIN_ORDER_VALUE", message, 422, data);
  if (code === "DELIVERY_ADDRESS_INVALID" || code === "DELIVERY_ADDRESS_CHANGED") {
    return new ShopError("DELIVERY_ADDRESS_INVALID", message, 422, data);
  }
  if (code === "ARTICLE_NOT_FOUND" || code === "CHECKOUT_VALIDATION_FAILED") {
    return new ShopError("LINE_REJECTED", message, 422, data);
  }
  if (status === 409) return new ShopError("CONFLICT", message, 409, data);
  if (status >= 400 && status < 500) return new ShopError("VALIDATION", message, status, data);
  return new ShopError("UNAVAILABLE", message, status >= 400 ? status : 502, data);
}
