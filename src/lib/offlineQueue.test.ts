// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateServiceRequestDTO } from "@/interfaces";
import { __resetDbForTests, offlineDb, type OfflineQueueItem } from "./idb";
import { decideReplay, hydratePayload, isReplayInProgress, replayQueue } from "./offlineQueue";

const payload: CreateServiceRequestDTO = {
  idempotencyKey: "key-0001-abcd",
  subjectType: "instance",
  subjectId: "instance-inv-10001",
  serviceType: "STK",
  site: "site-bonn",
  locationText: "Bonn Clinic, ICU, Room 4",
  deliveryAddress: "Warehouse",
  raisedBy: "Tester",
};

function item(over: Partial<OfflineQueueItem> = {}): OfflineQueueItem {
  return {
    id: over.id ?? crypto.randomUUID(),
    operation: "service-request",
    idempotencyKey: payload.idempotencyKey,
    payload,
    attachmentIds: [],
    createdAt: new Date().toISOString(),
    retryCount: 0,
    summary: "STK for pump",
    ...over,
  };
}

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("decideReplay — Section 25.1", () => {
  it("maps statuses to actions", () => {
    expect(decideReplay(201, { request: { reference: "SR-1" } })).toEqual({ action: "remove", reference: "SR-1" });
    expect(decideReplay(200, { request: { reference: "SR-1" } })).toEqual({ action: "remove", reference: "SR-1" });
    expect(decideReplay(409, { error: { details: { reference: "SR-9" } } })).toEqual({ action: "synced", reference: "SR-9" });
    expect(decideReplay(422, { error: { message: "Please enter the location of use." } })).toEqual({ action: "keep-error", message: "Please enter the location of use." });
    expect(decideReplay(400).action).toBe("keep-error");
    expect(decideReplay(401).action).toBe("stop");
    expect(decideReplay(403).action).toBe("stop");
    expect(decideReplay(503).action).toBe("retry-later");
    expect(decideReplay(429).action).toBe("retry-later");
    expect(decideReplay(null).action).toBe("retry-later");
  });
});

describe("replayQueue — IndexedDB + mutex", () => {
  beforeEach(async () => {
    __resetDbForTests();
    indexedDB = new IDBFactory();
  });

  it("stores a complete replayable submission and reattaches photos", async () => {
    const it1 = item({ attachmentIds: ["att-1"] });
    await offlineDb.enqueue(it1, [{ id: "att-1", kind: "fault_photo", dataUrl: "data:image/jpeg;base64,AAA" }]);
    const stored = await offlineDb.get(it1.id);
    expect(stored?.payload.idempotencyKey).toBe(payload.idempotencyKey);
    const hydrated = hydratePayload(stored!, await offlineDb.getAttachments(stored!.attachmentIds)) as CreateServiceRequestDTO;
    expect(hydrated.attachments).toEqual([{ kind: "fault_photo", url: "data:image/jpeg;base64,AAA" }]);
  });

  it("replays with the ORIGINAL idempotency key and marks sent items", async () => {
    await offlineDb.enqueue(item());
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.idempotencyKey).toBe(payload.idempotencyKey);
      return jsonResponse(201, { request: { reference: "SR-20260910-ABC" }, created: true });
    });
    const report = await replayQueue(fetchImpl);
    expect(report.sent).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [stored] = await offlineDb.list();
    expect(stored.syncedReference).toBe("SR-20260910-ABC");
  });

  it("keeps validation errors with an actionable message and does not retry aggressively", async () => {
    await offlineDb.enqueue(item());
    const fetchImpl = vi.fn(async () => jsonResponse(422, { error: { message: "Please confirm the suggested inspection type." } }));
    const report = await replayQueue(fetchImpl);
    expect(report.kept).toHaveLength(1);
    const [stored] = await offlineDb.list();
    expect(stored.lastError).toBe("Please confirm the suggested inspection type.");
    expect(stored.retryCount).toBe(1);
    expect(stored.syncedReference).toBeUndefined();
  });

  it("stops on 401 and leaves the remaining items untouched", async () => {
    await offlineDb.enqueue(item({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" }));
    await offlineDb.enqueue(item({ id: "b", createdAt: "2026-01-02T00:00:00.000Z" }));
    const fetchImpl = vi.fn(async () => jsonResponse(401, { error: { message: "Sign in required." } }));
    const report = await replayQueue(fetchImpl);
    expect(report.stopped).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const b = await offlineDb.get("b");
    expect(b?.lastError).toBeUndefined();
  });

  it("treats a network failure as retry-later", async () => {
    await offlineDb.enqueue(item());
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const report = await replayQueue(fetchImpl);
    expect(report.kept).toHaveLength(1);
    const [stored] = await offlineDb.list();
    expect(stored.lastError).toMatch(/No connection/);
  });

  it("runs only one replay loop at a time (duplicate protection)", async () => {
    await offlineDb.enqueue(item());
    let resolveFetch: (r: Response) => void = () => undefined;
    const fetchImpl = vi.fn(() => new Promise<Response>((r) => (resolveFetch = r)));
    const p1 = replayQueue(fetchImpl);
    const p2 = replayQueue(fetchImpl);
    expect(isReplayInProgress()).toBe(true);
    expect(p1).toBe(p2);
    // The loop reads IndexedDB before it fetches; wait until the fake fetch is actually pending.
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    resolveFetch(jsonResponse(201, { request: { reference: "SR-X" } }));
    await p1;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(isReplayInProgress()).toBe(false);
  });
});
