"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleRequestListDTO, ConsoleRequestRowDTO } from "@/interfaces/console";
import {
  portfolioContractorFilterSchema,
  type PortfolioContractorFilter,
} from "@/schemas/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

/** Partner console — customer portfolio (managed tenants overview + take-over). */
export function useDispositionList() {
  const t = useTranslations("console");
  const [rows, setRows] = useState<ConsoleRequestRowDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [pendingTakeOver, setPendingTakeOver] = useState<ConsoleRequestRowDTO | null>(null);
  const [contractorFilter, setContractorFilterRaw] =
    useState<PortfolioContractorFilter>("all");

  const setContractorFilter = useCallback((value: string) => {
    const parsed = portfolioContractorFilterSchema.safeParse(value);
    if (parsed.success) setContractorFilterRaw(parsed.data);
  }, []);

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

  const counts = useMemo(() => {
    let ours = 0;
    let others = 0;
    for (const row of rows) {
      if (row.isExecutor) ours += 1;
      else others += 1;
    }
    return { all: rows.length, ours, others };
  }, [rows]);

  const filtered = useMemo(() => {
    const byContractor = rows.filter((row) => {
      if (contractorFilter === "ours") return row.isExecutor;
      if (contractorFilter === "others") return !row.isExecutor;
      return true;
    });
    const q = keyword.trim().toLowerCase();
    if (!q) return byContractor;
    return byContractor.filter((row) =>
      [
        row.reference,
        row.tenantName,
        row.deviceLabel,
        row.deviceDetail ?? "",
        row.serviceType,
        row.executorCode ?? "",
        row.executorName ?? "",
        row.assigneeName ?? "",
        row.displayState,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, keyword, contractorFilter]);

  const askTakeOver = useCallback((row: ConsoleRequestRowDTO) => {
    if (!row.managed || row.isExecutor) return;
    setPendingTakeOver(row);
  }, []);

  const cancelTakeOver = useCallback(() => {
    if (busyRef) return;
    setPendingTakeOver(null);
  }, [busyRef]);

  const confirmTakeOver = useCallback(async () => {
    const row = pendingTakeOver;
    if (!row || row.managed === false || row.isExecutor) return;
    setBusyRef(row.reference);
    try {
      await api(`/api/partner/disposition/${encodeURIComponent(row.reference)}/take-over`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setPendingTakeOver(null);
      toast.success(t("dispositionTookOver"));
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("dispositionTakeOverFailed"));
    } finally {
      setBusyRef(null);
    }
  }, [pendingTakeOver, refresh, t]);

  return {
    rows,
    filtered,
    error,
    loading,
    keyword,
    setKeyword,
    busyRef,
    contractorFilter,
    setContractorFilter,
    counts,
    pendingTakeOver,
    askTakeOver,
    cancelTakeOver,
    confirmTakeOver,
    refresh,
  };
}
