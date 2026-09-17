"use client";

import { create } from "zustand";
import type { CapturedArticleDTO, InventarizeOffer, ResolveResponse, ServiceRequestDTO } from "@/interfaces";

/**
 * Section 34 — explicit UI state machine. Transitions are methods; anything
 * not listed here is impossible by construction.
 *
 * idle → resolving | manual-entry
 * manual-entry → resolving | idle
 * resolving → device (inventory/catalog/beudamed) | manual-capture (capture)
 * manual-capture → device | idle
 * device → service-request | parts | idle
 * service-request → submitting | queued | device
 * submitting → success | queued
 * queued → success | idle
 * parts → order-submitting | device
 * success → idle
 */
export type WorkflowPhase =
  | "idle"
  | "manual-entry"
  | "resolving"
  | "manual-capture"
  | "device"
  | "service-request"
  | "parts"
  | "submitting"
  | "queued"
  | "success";

export type { InventarizeOffer };

export interface SuccessInfo {
  kind: "service-request" | "order-request";
  reference: string;
  state: string;
  idempotencyKey: string;
  queued: boolean;
  /** Snapshot from create response — used to show dispatch results immediately. */
  request?: ServiceRequestDTO;
  /**
   * When set, show inventarize prompt after a catalog/BEUDAMED service request
   * before the dispatch success screen.
   */
  inventarize?: InventarizeOffer;
}

interface ScanState {
  phase: WorkflowPhase;
  resolution: ResolveResponse | null;
  captured: CapturedArticleDTO | null;
  /** Raw input that produced the current resolution — surfaced in manual capture. */
  lastRaw: string | null;
  success: SuccessInfo | null;
  lastError: string | null;

  startManualEntry(): void;
  cancelManualEntry(): void;
  startResolving(raw: string): void;
  resolved(result: ResolveResponse): void;
  resolveFailed(message: string): void;
  captureSaved(article: CapturedArticleDTO): void;
  cancelCapture(): void;
  continueToServiceRequest(): void;
  openParts(): void;
  backToDevice(): void;
  submitting(): void;
  queued(info: SuccessInfo): void;
  succeeded(info: SuccessInfo): void;
  reset(): void;
}

const ALLOWED: Record<WorkflowPhase, WorkflowPhase[]> = {
  idle: ["resolving", "manual-entry"],
  "manual-entry": ["resolving", "idle"],
  resolving: ["device", "manual-capture", "idle"],
  "manual-capture": ["device", "idle"],
  device: ["service-request", "parts", "idle"],
  "service-request": ["submitting", "queued", "device", "idle"],
  parts: ["submitting", "queued", "device", "idle"],
  submitting: ["success", "queued", "service-request", "parts"],
  queued: ["success", "idle"],
  success: ["idle"],
};

function transition(from: WorkflowPhase, to: WorkflowPhase): WorkflowPhase {
  if (!ALLOWED[from].includes(to)) {
    if (process.env.NODE_ENV !== "production") console.warn(`[scanStore] blocked transition ${from} → ${to}`);
    return from;
  }
  return to;
}

export const useScanStore = create<ScanState>()((set, get) => ({
  phase: "idle",
  resolution: null,
  captured: null,
  lastRaw: null,
  success: null,
  lastError: null,

  startManualEntry: () => set((s) => ({ phase: transition(s.phase, "manual-entry") })),
  cancelManualEntry: () => set((s) => ({ phase: transition(s.phase, "idle") })),
  startResolving: (raw) => set((s) => ({ phase: transition(s.phase, "resolving"), lastRaw: raw, lastError: null, captured: null })),
  resolved: (result) =>
    set((s) => ({
      resolution: result,
      phase: transition(s.phase, result.stage === "capture" ? "manual-capture" : "device"),
    })),
  resolveFailed: (message) => set((s) => ({ phase: transition(s.phase, "idle"), lastError: message })),
  captureSaved: (article) => set((s) => ({ captured: article, phase: transition(s.phase, "device") })),
  cancelCapture: () => set((s) => ({ phase: transition(s.phase, "idle"), resolution: null })),
  continueToServiceRequest: () => set((s) => ({ phase: transition(s.phase, "service-request") })),
  openParts: () => {
    // Section 34 — manual-capture → parts-order is not allowed: captures are service-only (DAT-302a).
    if (get().captured) return;
    set((s) => ({ phase: transition(s.phase, "parts") }));
  },
  backToDevice: () => set((s) => ({ phase: transition(s.phase, "device") })),
  submitting: () => set((s) => ({ phase: transition(s.phase, "submitting") })),
  queued: (info) => set((s) => ({ phase: transition(s.phase, "queued"), success: info })),
  succeeded: (info) => set((s) => ({ phase: transition(s.phase, "success"), success: info })),
  reset: () => set({ phase: "idle", resolution: null, captured: null, lastRaw: null, success: null, lastError: null }),
}));

/** The subject a request will be raised against, derived from the current resolution. */
export function currentSubject(s: Pick<ScanState, "resolution" | "captured">): { subjectType: "instance" | "model" | "captured"; subjectId: string } | null {
  if (s.captured) return { subjectType: "captured", subjectId: s.captured.id };
  if (s.resolution?.device) return { subjectType: "instance", subjectId: s.resolution.device.id };
  if (s.resolution?.model) return { subjectType: "model", subjectId: s.resolution.model.id };
  return null;
}
