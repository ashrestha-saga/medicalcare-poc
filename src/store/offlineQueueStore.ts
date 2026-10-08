"use client";

import { create } from "zustand";
import type { CreateOrderRequestDTO, CreateServiceRequestDTO } from "@/interfaces";
import { offlineDb, type InspectionCompletePayload, type OfflineAttachment, type OfflineQueueItem } from "@/lib/idb";
import { newClientId } from "@/lib/http/apiClient";
import { replayQueue, type ReplayReport } from "@/lib/offlineQueue";
import { useLogStore } from "./logStore";

/**
 * NFA-802 — pending requests, mirrored from IndexedDB. The store is a view;
 * IndexedDB is the source of truth so a reload never loses a queued request.
 */
interface OfflineQueueState {
  items: OfflineQueueItem[];
  inspectionQueue: OfflineQueueItem[];
  online: boolean;
  replaying: boolean;
  lastReport: ReplayReport | null;
  recentlySynced: { idempotencyKey: string; reference: string }[];
  loaded: boolean;

  load(): Promise<void>;
  setOnline(online: boolean): void;
  enqueueServiceRequest(payload: CreateServiceRequestDTO, photos: { kind: "nameplate" | "fault_photo"; dataUrl: string }[], summary: string): Promise<OfflineQueueItem>;
  enqueueOrderRequest(payload: CreateOrderRequestDTO, summary: string): Promise<OfflineQueueItem>;
  enqueueInspectionComplete(args: {
    runId: string;
    reference: string;
    idempotencyKey: string;
    result: "passed" | "passed_with_conditions" | "failed";
    note?: string | null;
    stepDraft: Record<string, { confirmed?: boolean | null; measuredValue?: string | null }>;
  }): Promise<OfflineQueueItem>;
  replay(): Promise<ReplayReport | null>;
  dismiss(id: string): Promise<void>;
}

export const useOfflineQueueStore = create<OfflineQueueState>()((set, get) => ({
  items: [],
  inspectionQueue: [],
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  replaying: false,
  lastReport: null,
  recentlySynced: [],
  loaded: false,

  load: async () => {
    const items = await offlineDb.list();
    set({
      items: items.filter((i) => i.operation !== "inspection-run-complete"),
      inspectionQueue: items.filter((i) => i.operation === "inspection-run-complete"),
      loaded: true,
    });
  },

  setOnline: (online) => set({ online }),

  enqueueServiceRequest: async (payload, photos, summary) => {
    // Photos are stored separately so the queue row stays small; strip them from the payload.
    const attachments: OfflineAttachment[] = photos.map((p) => ({ id: newClientId(), kind: p.kind, dataUrl: p.dataUrl }));
    const item: OfflineQueueItem = {
      id: newClientId(),
      operation: "service-request",
      idempotencyKey: payload.idempotencyKey,
      payload: { ...payload, attachments: undefined },
      attachmentIds: attachments.map((a) => a.id),
      createdAt: new Date().toISOString(),
      retryCount: 0,
      summary,
    };
    await offlineDb.enqueue(item, attachments);
    useLogStore.getState().log("queue", `Queued ${summary} (key ${payload.idempotencyKey.slice(0, 8)}…)`);
    await get().load();
    return item;
  },

  enqueueInspectionComplete: async (args) => {
    const steps = Object.entries(args.stepDraft).map(([stepId, v]) => ({ stepId, ...v }));
    const item: OfflineQueueItem = {
      id: newClientId(),
      operation: "inspection-run-complete",
      idempotencyKey: args.idempotencyKey,
      payload: {
        runId: args.runId,
        reference: args.reference,
        result: args.result,
        note: args.note ?? null,
        steps,
      },
      attachmentIds: [],
      createdAt: new Date().toISOString(),
      retryCount: 0,
      summary: args.reference,
    };
    await offlineDb.enqueue(item);
    useLogStore.getState().log("queue", `Queued inspection ${args.reference}`);
    await get().load();
    return item;
  },

  enqueueOrderRequest: async (payload, summary) => {
    const item: OfflineQueueItem = {
      id: newClientId(),
      operation: "order-request",
      idempotencyKey: payload.idempotencyKey,
      payload,
      attachmentIds: [],
      createdAt: new Date().toISOString(),
      retryCount: 0,
      summary,
    };
    await offlineDb.enqueue(item);
    useLogStore.getState().log("queue", `Queued ${summary}`);
    await get().load();
    return item;
  },

  replay: async () => {
    if (get().replaying || !get().online) return null;
    set({ replaying: true });
    try {
      const report = await replayQueue(fetch, (item) => useLogStore.getState().log("queue", `Replayed ${item.summary}`));
      // Remember what was confirmed so the workflow can move queued → success with a reference.
      const synced: { idempotencyKey: string; reference: string }[] = [];
      for (const id of report.sent) {
        const item = await offlineDb.get(id);
        if (item?.syncedReference) synced.push({ idempotencyKey: item.idempotencyKey, reference: item.syncedReference });
        await offlineDb.remove(id);
      }
      set({ lastReport: report, recentlySynced: [...get().recentlySynced, ...synced].slice(-20) });
      await get().load();
      return report;
    } finally {
      set({ replaying: false });
    }
  },

  dismiss: async (id) => {
    await offlineDb.remove(id);
    await get().load();
  },
}));
