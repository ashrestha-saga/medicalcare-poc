"use client";

import { useCallback, useState } from "react";
import type { ServiceRequestDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { completeWorkNoteSchema } from "@/schemas/forms";
import { toast } from "@/store/toastStore";
import { isCompletable, isStartable } from "./requestDisplay";

/**
 * Start / complete transitions for a single service request detail view.
 */
export function useRequestTransition(
  request: ServiceRequestDTO,
  onUpdated: (next: ServiceRequestDTO) => void,
) {
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [workNote, setWorkNote] = useState("");

  const startable = isStartable(request.state);
  const completable = isCompletable(request.state);

  const start = useCallback(async () => {
    setBusy(true);
    try {
      const next = await api<ServiceRequestDTO>(
        `/api/service-requests/${encodeURIComponent(request.reference)}/transition`,
        {
          method: "POST",
          body: JSON.stringify({ state: "in_progress" }),
        },
      );
      onUpdated(next);
      toast.success("Work started.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not start work.");
    } finally {
      setBusy(false);
    }
  }, [onUpdated, request.reference]);

  const complete = useCallback(async () => {
    const parsed = completeWorkNoteSchema.safeParse({ note: workNote });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please enter a work note.");
      return;
    }
    setBusy(true);
    try {
      const next = await api<ServiceRequestDTO>(
        `/api/service-requests/${encodeURIComponent(request.reference)}/transition`,
        {
          method: "POST",
          body: JSON.stringify({ state: "completed", note: parsed.data.note }),
        },
      );
      onUpdated(next);
      setCompleting(false);
      setWorkNote("");
      toast.success("Maintenance marked complete.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not complete.");
    } finally {
      setBusy(false);
    }
  }, [onUpdated, request.reference, workNote]);

  const openComplete = useCallback(() => setCompleting(true), []);

  const cancelComplete = useCallback(() => {
    setCompleting(false);
    setWorkNote("");
  }, []);

  return {
    busy,
    completing,
    workNote,
    setWorkNote,
    startable,
    completable,
    start,
    complete,
    openComplete,
    cancelComplete,
  };
}
