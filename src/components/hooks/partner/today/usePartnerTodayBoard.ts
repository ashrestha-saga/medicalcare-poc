"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { PartnerBoardTile } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";

export type PartnerTodayZones = {
  ent: PartnerBoardTile[];
  vor: PartnerBoardTile[];
  beob: PartnerBoardTile[];
};

/** Loads the partner console today board tiles. */
export function usePartnerTodayBoard() {
  const t = useTranslations("console");
  const [zones, setZones] = useState<PartnerTodayZones | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api<{ zones: PartnerTodayZones }>("/api/partner/dashboard/board");
        if (!cancelled) setZones(data.zones);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : t("todayLoadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return { zones, error, loading };
}
