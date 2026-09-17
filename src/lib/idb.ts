import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CreateOrderRequestDTO, CreateServiceRequestDTO } from "@/interfaces";

/**
 * NFA-802 / Section 25 — IndexedDB wrapper for the offline request queue.
 * Stores a *complete replayable submission*, never a pointer into Zustand state.
 */

export type QueueOperation = "service-request" | "order-request";

export interface OfflineAttachment {
  id: string;
  kind: "nameplate" | "fault_photo";
  /** Downscaled JPEG data URL (≤1600px, NFA-803). */
  dataUrl: string;
}

export interface OfflineQueueItem {
  id: string;
  operation: QueueOperation;
  idempotencyKey: string;
  payload: CreateServiceRequestDTO | CreateOrderRequestDTO;
  attachmentIds: string[];
  createdAt: string;
  retryCount: number;
  lastError?: string;
  lastStatus?: number;
  /** Set once the server confirmed the request (200/201/409-existing). */
  syncedReference?: string;
  /** Human-readable summary for the queue UI. */
  summary: string;
}

interface DeviceCareDB extends DBSchema {
  requests: { key: string; value: OfflineQueueItem; indexes: { byCreatedAt: string } };
  attachments: { key: string; value: OfflineAttachment };
  metadata: { key: string; value: { key: string; value: unknown } };
}

const DB_NAME = "devicecare";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DeviceCareDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<DeviceCareDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DeviceCareDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const requests = db.createObjectStore("requests", { keyPath: "id" });
        requests.createIndex("byCreatedAt", "createdAt");
        db.createObjectStore("attachments", { keyPath: "id" });
        db.createObjectStore("metadata", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

/** Test helper — drops the cached connection so a fresh fake DB can be used. */
export function __resetDbForTests() {
  dbPromise = null;
}

export const offlineDb = {
  async enqueue(item: OfflineQueueItem, attachments: OfflineAttachment[] = []): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(["requests", "attachments"], "readwrite");
    await Promise.all([
      tx.objectStore("requests").put(item),
      ...attachments.map((a) => tx.objectStore("attachments").put(a)),
      tx.done,
    ]);
  },

  async list(): Promise<OfflineQueueItem[]> {
    const db = await getDb();
    return db.getAllFromIndex("requests", "byCreatedAt");
  },

  async get(id: string): Promise<OfflineQueueItem | undefined> {
    const db = await getDb();
    return db.get("requests", id);
  },

  async update(item: OfflineQueueItem): Promise<void> {
    const db = await getDb();
    await db.put("requests", item);
  },

  async remove(id: string): Promise<void> {
    const db = await getDb();
    const item = await db.get("requests", id);
    const tx = db.transaction(["requests", "attachments"], "readwrite");
    await Promise.all([
      tx.objectStore("requests").delete(id),
      ...(item?.attachmentIds ?? []).map((aid) => tx.objectStore("attachments").delete(aid)),
      tx.done,
    ]);
  },

  async getAttachments(ids: string[]): Promise<OfflineAttachment[]> {
    const db = await getDb();
    const rows = await Promise.all(ids.map((id) => db.get("attachments", id)));
    return rows.filter((r): r is OfflineAttachment => Boolean(r));
  },

  async setMeta(key: string, value: unknown): Promise<void> {
    const db = await getDb();
    await db.put("metadata", { key, value });
  },

  async getMeta<T>(key: string): Promise<T | undefined> {
    const db = await getDb();
    return (await db.get("metadata", key))?.value as T | undefined;
  },

  async clearAll(): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(["requests", "attachments", "metadata"], "readwrite");
    await Promise.all([tx.objectStore("requests").clear(), tx.objectStore("attachments").clear(), tx.objectStore("metadata").clear(), tx.done]);
  },
};
