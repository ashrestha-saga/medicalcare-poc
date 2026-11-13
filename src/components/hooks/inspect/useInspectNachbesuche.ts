"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { InspectFollowUpListDTO } from "@/interfaces/pruefpartner";
import { api, ApiError } from "@/lib/http/apiClient";

/** Loads the signed-in technician’s follow-up proposals for Nachbesuche. */
export function useInspectNachbesuche() {
  const t = useTranslations("pruefpartner");
  const [data, setData] = useState<InspectFollowUpListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api<InspectFollowUpListDTO>("/api/partner/inspect/follow-ups");
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : t("loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return { rows: data?.rows ?? [], error, loading };
}
