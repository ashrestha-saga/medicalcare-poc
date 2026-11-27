"use client";

import { useCallback, useState } from "react";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

export type ExternalPerformanceForm = {
  performedAt: string;
  performedBy: string;
  result: "passed" | "passed_with_conditions" | "failed";
  note: string;
  file: File | null;
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/** E108 — upload a third-party report for a duty (POST /api/duties/:id/performances/external). */
export function useExternalPerformance(onRecorded?: () => void) {
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (dutyId: string, form: ExternalPerformanceForm): Promise<boolean> => {
      setBusy(true);
      try {
        let dataUrl: string | null = null;
        if (form.file) {
          if (form.file.size > MAX_FILE_BYTES) {
            toast.error("File is too large (max 8 MB)");
            return false;
          }
          dataUrl = await readAsDataUrl(form.file);
        }
        await api(`/api/duties/${dutyId}/performances/external`, {
          method: "POST",
          body: JSON.stringify({
            performedAt: form.performedAt,
            performedBy: form.performedBy.trim(),
            result: form.result,
            note: form.note.trim() || null,
            dataUrl,
          }),
        });
        onRecorded?.();
        return true;
      } catch (err) {
        toast.error(err instanceof ApiError || err instanceof Error ? err.message : "Upload failed");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onRecorded],
  );

  return { busy, submit };
}
