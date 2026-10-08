"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleRequestListDTO, ConsoleRequestRowDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

/** Partner console — disposition queue, drafts, and advance. */
export function useDispositionList() {
  const t = useTranslations("console");
  const [rows, setRows] = useState<ConsoleRequestRowDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [draftDates, setDraftDates] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ConsoleRequestListDTO>("/api/partner/disposition");
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("dispositionLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.reference,
        row.tenantName,
        row.deviceLabel,
        row.deviceDetail ?? "",
        row.serviceType,
        row.executorCode ?? "",
        row.assigneeName ?? "",
        row.displayState,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, keyword]);

  const appointmentValue = useCallback(
    (row: ConsoleRequestRowDTO) => draftDates[row.reference] ?? row.scheduledAt ?? "",
    [draftDates],
  );

  const onDraftDate = useCallback((reference: string, value: string) => {
    setDraftDates((prev) => ({ ...prev, [reference]: value }));
  }, []);

  const onAdvance = useCallback(
    async (row: ConsoleRequestRowDTO) => {
      setBusyRef(row.reference);
      try {
        const scheduledAt = appointmentValue(row) || null;
        await api(`/api/partner/disposition/${encodeURIComponent(row.reference)}/advance`, {
          method: "POST",
          body: JSON.stringify({ scheduledAt }),
        });
        setDraftDates((prev) => {
          const next = { ...prev };
          delete next[row.reference];
          return next;
        });
        toast.success(t("dispositionAdvanced"));
        await refresh();
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : t("dispositionAdvanceFailed"));
      } finally {
        setBusyRef(null);
      }
    },
    [appointmentValue, refresh, t],
  );

  return {
    rows,
    filtered,
    error,
    loading,
    keyword,
    setKeyword,
    busyRef,
    appointmentValue,
    onDraftDate,
    onAdvance,
    refresh,
  };
}
