"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleDutyListDTO, ConsoleDutyRowDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";

/** Partner console — due-dates list with overdue filter (URL: ?overdue=1). */
export function useDueDatesList() {
  const t = useTranslations("console");
  const overdueParam = useQueryParam("overdue");
  const { sync } = useSyncQueryParams();
  const [rows, setRows] = useState<ConsoleDutyRowDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [overdueOnly, setOverdueOnlyState] = useState(overdueParam === "1");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    setOverdueOnlyState(overdueParam === "1");
  }, [overdueParam]);

  const setOverdueOnly = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setOverdueOnlyState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        sync({ overdue: next ? "1" : null });
        return next;
      });
    },
    [sync],
  );

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

  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  const assignDuty = useCallback(
    async (dutyId: string) => {
      setAssigningId(dutyId);
      setAssignMessage(null);
      try {
        const result = await api<{ created: boolean; request: { reference: string } }>(
          `/api/partner/due-dates/${dutyId}/assign`,
          { method: "POST", body: JSON.stringify({}) },
        );
        setAssignMessage(
          result.created
            ? t("dueDatesAssignCreated", { reference: result.request.reference })
            : t("dueDatesAssignExists", { reference: result.request.reference }),
        );
        await refresh();
      } catch (e) {
        setAssignMessage(e instanceof ApiError ? e.message : t("dueDatesAssignFailed"));
      } finally {
        setAssigningId(null);
      }
    },
    [refresh, t],
  );

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
    assignDuty,
    assigningId,
    assignMessage,
  };
}
