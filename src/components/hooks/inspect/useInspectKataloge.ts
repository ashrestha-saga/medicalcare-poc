"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/http/apiClient";

export type InspectCatalogueRow = {
  id: string;
  code: string;
  label: string;
  draft: boolean;
  noCatalogue: boolean;
  inspectionTypeCode: string;
};

/** Loads partner inspection catalogues for the inspect Kataloge screen. */
export function useInspectKataloge() {
  const t = useTranslations("pruefpartner");
  const [rows, setRows] = useState<InspectCatalogueRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ catalogues: InspectCatalogueRow[] }>(
          "/api/partner/inspect/catalogues",
        );
        if (!cancelled) setRows(res.catalogues);
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

  const drafts = useMemo(() => rows.filter((r) => r.draft), [rows]);
  const live = useMemo(() => rows.filter((r) => !r.draft), [rows]);

  return { rows, drafts, live, error, loading };
}
