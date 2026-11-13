"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/http/apiClient";

/** Starts a site visit for the day-plan site card (links open job refs). */
export function useSiteVisitStart(input: {
  siteId: string | null;
  references: string[];
  onVisitStarted?: () => void;
}) {
  const t = useTranslations("pruefpartner");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function startVisit() {
    setBusy(true);
    setErr(null);
    try {
      await api<{ visitId: string; startedAt: string }>("/api/partner/inspect/visits/start", {
        method: "POST",
        body: JSON.stringify({
          siteId: input.siteId,
          references: input.references,
        }),
      });
      input.onVisitStarted?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("visitStartFailed"));
    } finally {
      setBusy(false);
    }
  }

  return { busy, err, startVisit };
}
