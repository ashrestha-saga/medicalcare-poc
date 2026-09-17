import type { CreateOrderRequestDTO, CreateServiceRequestDTO } from "@/interfaces";
import { offlineDb, type OfflineAttachment, type OfflineQueueItem } from "./idb";

/**
 * Section 25.1 — replay rules, as a pure decision function so they can be
 * unit-tested without IndexedDB or a network.
 */
export type ReplayDecision =
  | { action: "remove"; reference?: string } // 2xx → done
  | { action: "synced"; reference?: string } // 409 existing → mark synchronized
  | { action: "keep-error"; message: string } // 400/404/422 → keep + actionable error
  | { action: "retry-later"; message: string } // 5xx / network → try again later
  | { action: "stop"; message: string }; // 401/403 → stop replay until session restored

export function decideReplay(status: number | null, body?: unknown): ReplayDecision {
  const errorMessage =
    body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" && "message" in body.error
      ? String((body.error as { message: unknown }).message)
      : undefined;
  const reference =
    body && typeof body === "object"
      ? ((body as { request?: { reference?: string }; order?: { reference?: string } }).request?.reference ??
        (body as { order?: { reference?: string } }).order?.reference)
      : undefined;

  if (status === null) return { action: "retry-later", message: "No connection. Will retry when online." };
  if (status === 200 || status === 201) return { action: "remove", reference };
  if (status === 401 || status === 403) return { action: "stop", message: "Sign in again to send queued requests." };
  if (status === 409) return { action: "synced", reference: (body as { error?: { details?: { reference?: string } } })?.error?.details?.reference };
  if (status === 400 || status === 404 || status === 422) return { action: "keep-error", message: errorMessage ?? "The request needs correction." };
  if (status === 429) return { action: "retry-later", message: "Server busy. Will retry shortly." };
  return { action: "retry-later", message: errorMessage ?? `Server error (${status}). Will retry later.` };
}

export function endpointFor(operation: OfflineQueueItem["operation"]): string {
  return operation === "service-request" ? "/api/service-requests" : "/api/order-requests";
}

/** Reattaches stored photos to the payload right before sending. */
export function hydratePayload(item: OfflineQueueItem, attachments: OfflineAttachment[]): CreateServiceRequestDTO | CreateOrderRequestDTO {
  if (item.operation !== "service-request") return item.payload;
  const payload = item.payload as CreateServiceRequestDTO;
  return { ...payload, attachments: attachments.map((a) => ({ kind: a.kind, url: a.dataUrl })) };
}

export interface ReplayReport {
  processed: number;
  sent: string[];
  kept: string[];
  stopped: boolean;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Section 25.2 — exactly one replay loop per tab. The mutex lives at module
 * scope; a second caller gets the in-flight promise instead of a new loop.
 */
let inFlight: Promise<ReplayReport> | null = null;

export function replayQueue(fetchImpl: FetchLike = fetch, onProgress?: (item: OfflineQueueItem) => void): Promise<ReplayReport> {
  if (inFlight) return inFlight;
  inFlight = runReplay(fetchImpl, onProgress).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function isReplayInProgress(): boolean {
  return inFlight !== null;
}

async function runReplay(fetchImpl: FetchLike, onProgress?: (item: OfflineQueueItem) => void): Promise<ReplayReport> {
  const report: ReplayReport = { processed: 0, sent: [], kept: [], stopped: false };
  const items = (await offlineDb.list()).filter((i) => !i.syncedReference);

  for (const item of items) {
    report.processed++;
    const attachments = await offlineDb.getAttachments(item.attachmentIds);
    const body = hydratePayload(item, attachments);

    let status: number | null = null;
    let parsed: unknown;
    try {
      const res = await fetchImpl(endpointFor(item.operation), {
        method: "POST",
        headers: { "content-type": "application/json", "x-correlation-id": item.payload.correlationId ?? item.id },
        body: JSON.stringify(body), // same idempotencyKey as the original attempt (SS-701)
      });
      status = res.status;
      parsed = await res.json().catch(() => undefined);
    } catch {
      status = null;
    }

    const decision = decideReplay(status, parsed);
    switch (decision.action) {
      case "remove":
        await offlineDb.update({ ...item, syncedReference: decision.reference ?? "sent", lastStatus: status ?? undefined, lastError: undefined });
        report.sent.push(item.id);
        break;
      case "synced":
        await offlineDb.update({ ...item, syncedReference: decision.reference ?? "existing", lastStatus: status ?? undefined, lastError: undefined });
        report.sent.push(item.id);
        break;
      case "keep-error":
        await offlineDb.update({ ...item, retryCount: item.retryCount + 1, lastError: decision.message, lastStatus: status ?? undefined });
        report.kept.push(item.id);
        break;
      case "retry-later":
        await offlineDb.update({ ...item, retryCount: item.retryCount + 1, lastError: decision.message, lastStatus: status ?? undefined });
        report.kept.push(item.id);
        break;
      case "stop":
        await offlineDb.update({ ...item, lastError: decision.message, lastStatus: status ?? undefined });
        report.kept.push(item.id);
        report.stopped = true;
        break;
    }
    onProgress?.(item);
    if (report.stopped) break;
  }
  return report;
}
