"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleDutyListDTO, ConsoleDutyRowDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";

/** Partner console — due-dates list with overdue filter. */
export function useDueDatesList() {
  const t = useTranslations("console");
  const [rows, setRows] = useState<ConsoleDutyRowDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [keyword, setKeyword] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = overdueOnly ? "?overdue=1" : "";
      const data = await api<ConsoleDutyListDTO>(`/api/partner/due-dates${q}`);
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("dueDatesLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [overdueOnly, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.tenantName, row.inventoryNumber ?? "", row.deviceLabel, row.dutyKey, row.title ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, keyword]);

  return {
    rows,
    filtered,
    error,
    loading,
    overdueOnly,
    setOverdueOnly,
    keyword,
    setKeyword,
    refresh,
  };
}
