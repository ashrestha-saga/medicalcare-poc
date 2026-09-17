"use client";

import { useCallback, useRef } from "react";
import type { ResolveResponse } from "@/interfaces";
import { api, ApiError, NetworkError } from "@/lib/http/apiClient";
import { parseIdentifier } from "@/lib/gs1";
import { useLogStore } from "@/store/logStore";
import { useRequestStore } from "@/store/requestStore";
import { useScanStore } from "@/store/scanStore";
import { toast } from "@/store/toastStore";

/**
 * Section 33 — camera and manual entry converge here. One code path:
 * parse (client, for feedback) → POST /api/resolve → store transition.
 */
export function useResolve() {
  const startResolving = useScanStore((s) => s.startResolving);
  const resolved = useScanStore((s) => s.resolved);
  const resolveFailed = useScanStore((s) => s.resolveFailed);
  const resetForm = useRequestStore((s) => s.resetForm);
  const applyProposal = useRequestStore((s) => s.applyProposal);
  const prefillLocation = useRequestStore((s) => s.prefillLocation);
  const inFlight = useRef(false);

  const resolve = useCallback(
    async (raw: string, origin: "scan" | "manual") => {
      if (inFlight.current) return;
      const trimmed = raw.trim();
      if (!trimmed) return;
      inFlight.current = true;
      const log = useLogStore.getState().log;
      const parsed = parseIdentifier(trimmed);
      log("scan", `${origin === "scan" ? "Scanned" : "Entered"} "${trimmed}" → ${parsed.kind}${parsed.gtin ? ` GTIN ${parsed.gtin}` : ""}${parsed.serial ? ` SN ${parsed.serial}` : ""}`);
      startResolving(trimmed);
      try {
        const requestBody = { raw: trimmed, context: "service" as const };
        log("resolve", `Request POST /api/resolve ${JSON.stringify(requestBody)}`);
        const result = await api<ResolveResponse>("/api/resolve", { method: "POST", body: JSON.stringify(requestBody) });
        log(
          "resolve",
          `Response stage=${result.stage} source=${result.source.system}${result.source.cached ? " (cached)" : ""}${result.model ? ` model=${result.model.tradeName ?? result.model.id}` : ""}${result.device ? ` device=${result.device.id}` : ""}${result.classificationProposal ? ` proposal=${result.classificationProposal.confidence}` : ""}`,
        );
        resetForm();
        applyProposal(result.classificationProposal);
        if (result.device?.location) {
          prefillLocation({
            siteId: result.device.location.siteId,
            areaId: result.device.location.areaId,
            room: result.device.location.room,
          });
        }
        resolved(result);
      } catch (e) {
        if (e instanceof NetworkError) {
          // Offline: we cannot resolve, but the user can still capture manually.
          log("resolve", "Offline — falling back to manual capture");
          resetForm();
          resolved({
            stage: "capture",
            identifier: parsed,
            source: { system: "none", fetchedAt: new Date().toISOString(), cached: false },
            correlationId: "offline",
          });
        } else {
          const message = e instanceof ApiError ? e.message : "We couldn't identify this device. Please try again.";
          log("error", message);
          toast.error(message);
          resolveFailed(message);
        }
      } finally {
        inFlight.current = false;
      }
    },
    [startResolving, resolved, resolveFailed, resetForm, applyProposal, prefillLocation],
  );

  return { resolve };
}
