"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/http/apiClient";

export type InspectAccessPayload = {
  name: string;
  organisationName: string;
  roleLabel: "technician" | "external";
  subject: string;
  warningCount: number;
  rows: {
    group: string;
    title: string;
    evidence: string | null;
    validTo: string | null;
    status: "ok" | "warn" | "stop";
    daysLeft: number | null;
  }[];
};

/** Loads Mein Zugang evidence for the inspect rail. */
export function useInspectZugang() {
  const t = useTranslations("pruefpartner");
  const [data, setData] = useState<InspectAccessPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api<InspectAccessPayload>("/api/partner/inspect/access");
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

  return { data, error, loading };
}

/** Lightweight warning badge for the inspect nav (ignores failures). */
export function useInspectAccessWarningCount() {
  const [warningCount, setWarningCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api<Pick<InspectAccessPayload, "warningCount">>(
          "/api/partner/inspect/access",
        );
        if (!cancelled) setWarningCount(res.warningCount ?? 0);
      } catch {
        /* ignore — badge is optional chrome */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return warningCount;
}
