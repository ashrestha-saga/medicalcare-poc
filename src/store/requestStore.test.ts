// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { INSPECTION_TYPES } from "@/constants/inspectionTypes";
import { useRequestStore } from "./requestStore";
import { useScanStore } from "./scanStore";

describe("requestStore — manual service type", () => {
  beforeEach(() => useRequestStore.getState().resetForm());

  it("patches service type without mutating the master inspection list", () => {
    const before = INSPECTION_TYPES.map((t) => t.code);
    useRequestStore.getState().patch({ serviceType: "STK" });
    expect(useRequestStore.getState().form.serviceType).toBe("STK");
    expect(INSPECTION_TYPES.map((t) => t.code)).toEqual(before);
  });

  it("keeps one idempotency key for the life of a form and mints a new one on reset", () => {
    const k1 = useRequestStore.getState().form.idempotencyKey;
    useRequestStore.getState().patch({ note: "x" });
    expect(useRequestStore.getState().form.idempotencyKey).toBe(k1);
    useRequestStore.getState().resetForm();
    expect(useRequestStore.getState().form.idempotencyKey).not.toBe(k1);
  });
});

describe("scanStore — Section 34 state machine", () => {
  beforeEach(() => useScanStore.getState().reset());

  it("blocks impossible transitions", () => {
    useScanStore.getState().succeeded({ kind: "service-request", reference: "x", state: "captured", idempotencyKey: "k", queued: false });
    expect(useScanStore.getState().phase).toBe("idle"); // idle → success is not allowed
    useScanStore.getState().continueToServiceRequest();
    expect(useScanStore.getState().phase).toBe("idle");
  });

  it("walks the happy path", () => {
    const s = useScanStore.getState();
    s.startManualEntry();
    expect(useScanStore.getState().phase).toBe("manual-entry");
    s.startResolving("INV-10001");
    expect(useScanStore.getState().phase).toBe("resolving");
    s.resolved({ stage: "inventory", identifier: { raw: "INV-10001", kind: "inventory" }, source: { system: "device-inventory", fetchedAt: "", cached: false }, correlationId: "c" });
    expect(useScanStore.getState().phase).toBe("device");
    s.continueToServiceRequest();
    s.submitting();
    s.queued({ kind: "service-request", reference: "", state: "queued", idempotencyKey: "k", queued: true });
    expect(useScanStore.getState().phase).toBe("queued");
    s.succeeded({ kind: "service-request", reference: "SR-1", state: "captured", idempotencyKey: "k", queued: false });
    expect(useScanStore.getState().phase).toBe("success");
  });

  it("a manual capture can never reach the parts order (DAT-302a)", () => {
    const s = useScanStore.getState();
    s.startResolving("???");
    s.resolved({ stage: "capture", identifier: { raw: "???", kind: "unknown" }, source: { system: "none", fetchedAt: "", cached: false }, correlationId: "c" });
    expect(useScanStore.getState().phase).toBe("manual-capture");
    s.captureSaved({ id: "cap", name: "Thing", manufacturer: null, number: null, numberType: "none", nameplateAttachmentId: null, capturedBy: null, capturedAt: "", serviceOnly: true });
    expect(useScanStore.getState().phase).toBe("device");
    s.openParts();
    expect(useScanStore.getState().phase).toBe("device");
  });
});
