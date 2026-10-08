"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleAuditListDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";

/** Partner console — organisation audit feed. */
export function usePartnerActivity() {
  const t = useTranslations("console");
  const [data, setData] = useState<ConsoleAuditListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void api<ConsoleAuditListDTO>("/api/partner/audit?limit=100")
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : t("auditLoadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return { data, error, loading };
}
