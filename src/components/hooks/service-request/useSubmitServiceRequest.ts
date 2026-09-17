"use client";

import { useCallback, useState } from "react";
import type { CreateServiceRequestDTO, CreateServiceRequestResult, InventarizeOffer } from "@/interfaces";
import { api, ApiError, NetworkError, isOffline } from "@/lib/http/apiClient";
import { useLogStore } from "@/store/logStore";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { useRequestStore } from "@/store/requestStore";
import { useScanStore } from "@/store/scanStore";
import { toast } from "@/store/toastStore";

function buildInventarizeOffer(
  locationText: string,
): InventarizeOffer | undefined {
  const { resolution, captured } = useScanStore.getState();
  const form = useRequestStore.getState().form;
  if (captured) return undefined;
  if (!resolution?.model) return undefined;
  if (resolution.stage !== "catalog" && resolution.stage !== "beudamed") return undefined;

  const model = resolution.model;
  return {
    modelId: model.id,
    tradeName: model.tradeName,
    modelName: model.modelName,
    udiDi: model.udiDi ?? resolution.identifier.udiDi ?? resolution.identifier.gtin ?? null,
    locationText,
    areaId: form.areaId.trim() || null,
    room: form.room.trim() || null,
    serialHint: resolution.identifier.serial ?? null,
    commissionedYear: String(new Date().getFullYear()),
  };
}

/**
 * Section 34 — service-request → submitting → success | queued.
 * Offline or a network failure mid-send → queue with the SAME idempotency key
 * (NFA-802 / SS-701). Business validation errors (422) are shown, not queued.
 */
export function useSubmitServiceRequest() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submitting = useScanStore((s) => s.submitting);
  const succeeded = useScanStore((s) => s.succeeded);
  const queued = useScanStore((s) => s.queued);
  const backToServiceRequest = useScanStore((s) => s.continueToServiceRequest);
  const enqueue = useOfflineQueueStore((s) => s.enqueueServiceRequest);
  const resetForm = useRequestStore((s) => s.resetForm);

  const submit = useCallback(
    async (payload: CreateServiceRequestDTO, summary: string) => {
      const log = useLogStore.getState().log;
      setFieldErrors({});
      // Snapshot before resetForm clears area/room.
      const inventarize = buildInventarizeOffer(payload.locationText);
      submitting();

      const photos = (payload.attachments ?? []).map((a) => ({ kind: a.kind, dataUrl: a.url }));
      const queueIt = async (reason: string) => {
        log("queue", `${reason} — saved locally with key ${payload.idempotencyKey.slice(0, 8)}…`);
        await enqueue(payload, photos, summary);
        queued({
          kind: "service-request",
          reference: "",
          state: "queued",
          idempotencyKey: payload.idempotencyKey,
          queued: true,
          inventarize,
        });
        toast.info("Request saved locally. It will be sent when the connection returns.");
        resetForm();
      };

      if (isOffline()) {
        await queueIt("Offline");
        return;
      }

      try {
        const result = await api<CreateServiceRequestResult>("/api/service-requests", {
          method: "POST",
          body: JSON.stringify(payload),
          correlationId: payload.correlationId,
        });
        log("request", `${result.created ? "Created" : "Already existed"}: ${result.request.reference} (${result.request.state})`);
        succeeded({
          kind: "service-request",
          reference: result.request.reference,
          state: result.request.state,
          idempotencyKey: payload.idempotencyKey,
          queued: false,
          request: result.request,
          inventarize,
        });
        resetForm();
      } catch (e) {
        if (e instanceof NetworkError) {
          await queueIt("Connection dropped during send");
          return;
        }
        // Validation / business errors are user-correctable — back to the form.
        const message = e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
        const field = e instanceof ApiError && e.details && typeof e.details === "object" && "field" in e.details ? String((e.details as { field: string }).field) : undefined;
        if (field) setFieldErrors({ [field]: message });
        log("error", `${e instanceof ApiError ? e.status : "?"} ${message}`);
        toast.error(message);
        backToServiceRequest();
      }
    },
    [submitting, succeeded, queued, backToServiceRequest, enqueue, resetForm],
  );

  return { submit, fieldErrors, setFieldErrors };
}
