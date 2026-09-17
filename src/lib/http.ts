/**
 * Server-side fetch wrapper — Section 29.1 / NFA-801.
 * Hard timeout via AbortController plus bounded retry for transient failures.
 */

export class HttpTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "HttpTimeoutError";
  }
}

export class HttpStatusError extends Error {
  constructor(
    public readonly status: number,
    public readonly bodyText: string,
  ) {
    super(`HTTP ${status}`);
    this.name = "HttpStatusError";
  }
}

export interface FetchOptions extends RequestInit {
  timeoutMs: number;
  /** Retries only on network errors, timeouts and 5xx. Default 0. */
  retries?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
}

export async function fetchWithTimeout(url: string, options: FetchOptions): Promise<Response> {
  const { timeoutMs, retries = 0, retryDelayMs = 250, fetchImpl = fetch, ...init } = options;

  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { ...init, signal: controller.signal });
      if (res.status >= 500 && attempt < retries) {
        lastError = new HttpStatusError(res.status, await safeText(res));
      } else {
        return res;
      }
    } catch (error) {
      lastError = controller.signal.aborted ? new HttpTimeoutError(timeoutMs) : error;
      if (attempt >= retries) throw lastError;
    } finally {
      clearTimeout(timer);
    }
    attempt++;
    await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
  }
  throw lastError ?? new Error("fetch failed");
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 2000);
  } catch {
    return "";
  }
}

export async function fetchJson<T>(url: string, options: FetchOptions): Promise<{ status: number; data: T }> {
  const res = await fetchWithTimeout(url, options);
  if (!res.ok) throw new HttpStatusError(res.status, await safeText(res));
  return { status: res.status, data: (await res.json()) as T };
}
