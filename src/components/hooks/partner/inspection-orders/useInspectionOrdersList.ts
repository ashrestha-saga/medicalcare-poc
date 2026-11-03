"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleRequestListDTO, ConsoleRequestRowDTO } from "@/interfaces/console";
import { toDatetimeLocalValue } from "@/lib/format";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import {
  dispatchPipelineFilterSchema,
  type DispatchPipelineFilter,
} from "@/schemas/console";
import { toast } from "@/store/toastStore";

export type DispatchAssignee = {
  userId: string;
  name: string;
  isExternal: boolean;
};

export type DispositionFocus =
  | "unscheduled"
  | "return"
  | "out_of_contract"
  | null;

function pipelineBucket(row: ConsoleRequestRowDTO): DispatchPipelineFilter {
  if (row.displayState === "abgeschlossen" || row.displayState === "abgelehnt") return "done";
  if (row.displayState === "in_arbeit") return "in_progress";
  if (row.displayState === "terminiert") return "scheduled";
  if (row.displayState === "zugewiesen") return "needs_appointment";
  return "needs_handler";
}

function parseFocus(raw: string | null): DispositionFocus {
  if (raw === "unscheduled" || raw === "return" || raw === "out_of_contract") return raw;
  return null;
}

const RETURN_MS = 48 * 3600 * 1000;

function matchesFocus(row: ConsoleRequestRowDTO, focus: DispositionFocus): boolean {
  if (!focus) return true;
  if (focus === "unscheduled") {
    return (
      !row.scheduledAt &&
      row.displayState !== "abgeschlossen" &&
      row.displayState !== "abgelehnt"
    );
  }
  if (focus === "return") {
    if (row.displayState !== "abgeschlossen" && row.state !== "completed") return false;
    const stamp = row.updatedAt ?? row.raisedAt;
    if (!stamp) return false;
    return Date.now() - new Date(stamp).getTime() > RETURN_MS;
  }
  if (focus === "out_of_contract") return row.managed === false;
  return true;
}

/** Partner console — Our dispatch (executor queue: handler, appointment, advance). */
export function useInspectionOrdersList() {
  const t = useTranslations("console");
  const qParam = useQueryParam("q");
  const pipelineParam = useQueryParam("pipeline");
  const reasonParam = useQueryParam("reason");
  const focusParam = useQueryParam("focus");
  const { sync } = useSyncQueryParams();
  const [rows, setRows] = useState<ConsoleRequestRowDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeywordState] = useState(qParam ?? "");
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [draftDates, setDraftDates] = useState<Record<string, string>>({});
  const [pipeline, setPipelineRaw] = useState<DispatchPipelineFilter>(() => {
    const parsed = dispatchPipelineFilterSchema.safeParse(pipelineParam);
    return parsed.success ? parsed.data : "all";
  });
  const [assigneesByTenant, setAssigneesByTenant] = useState<
    Record<string, DispatchAssignee[]>
  >({});
  const assigneesCacheRef = useRef(assigneesByTenant);
  assigneesCacheRef.current = assigneesByTenant;
  const [assigneesLoading, setAssigneesLoading] = useState<string | null>(null);

  const focus = parseFocus(focusParam);
  const reason = reasonParam?.trim() || null;

  useEffect(() => {
    const parsed = dispatchPipelineFilterSchema.safeParse(pipelineParam);
    setPipelineRaw(parsed.success ? parsed.data : "all");
  }, [pipelineParam]);

  const setPipeline = useCallback(
    (value: string) => {
      const parsed = dispatchPipelineFilterSchema.safeParse(value);
      if (!parsed.success) return;
      setPipelineRaw(parsed.data);
      sync({ pipeline: parsed.data === "all" ? null : parsed.data });
    },
    [sync],
  );

  const clearFocusFilters = useCallback(() => {
    sync({ reason: null, focus: null });
  }, [sync]);

  useEffect(() => {
    setKeywordState(qParam ?? "");
  }, [qParam]);

  const setKeyword = useCallback(
    (value: string) => {
      setKeywordState(value);
      sync({ q: value.trim() || null });
    },
    [sync],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ConsoleRequestListDTO>("/api/partner/inspection-orders");
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("assignmentsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const next: Record<DispatchPipelineFilter, number> = {
      all: rows.length,
      needs_handler: 0,
      needs_appointment: 0,
      scheduled: 0,
      in_progress: 0,
      done: 0,
    };
    for (const row of rows) {
      next[pipelineBucket(row)] += 1;
    }
    return next;
  }, [rows]);

  const filtered = useMemo(() => {
    let list =
      pipeline === "all" ? rows : rows.filter((row) => pipelineBucket(row) === pipeline);
    if (reason) {
      list = list.filter((row) => (row.reason ?? "").toLowerCase() === reason.toLowerCase());
    }
    if (focus) {
      list = list.filter((row) => matchesFocus(row, focus));
    }
    const q = keyword.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) =>
      [
        row.reference,
        row.tenantName,
        row.deviceLabel,
        row.deviceDetail ?? "",
        row.serviceType,
        row.assigneeName ?? "",
        row.displayState,
        row.reason ?? "",
        row.managed ? "managed" : "external",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, keyword, pipeline, reason, focus]);

  const appointmentValue = useCallback(
    (row: ConsoleRequestRowDTO) =>
      draftDates[row.reference] ?? toDatetimeLocalValue(row.scheduledAt) ?? "",
    [draftDates],
  );

  const onDraftDate = useCallback((reference: string, value: string) => {
    setDraftDates((prev) => ({ ...prev, [reference]: value }));
  }, []);

  const ensureAssignees = useCallback(async (tenantId: string) => {
    if (tenantId in assigneesCacheRef.current) return;
    setAssigneesLoading(tenantId);
    try {
      const data = await api<{ assignees: DispatchAssignee[] }>(
        `/api/partner/disposition/assignees?tenantId=${encodeURIComponent(tenantId)}`,
      );
      setAssigneesByTenant((prev) => ({ ...prev, [tenantId]: data.assignees }));
    } catch {
      setAssigneesByTenant((prev) => ({ ...prev, [tenantId]: [] }));
    } finally {
      setAssigneesLoading((cur) => (cur === tenantId ? null : cur));
    }
  }, []);

  const onAssignHandler = useCallback(
    async (row: ConsoleRequestRowDTO, assigneeUserId: string | null) => {
      setBusyRef(row.reference);
      try {
        await api(`/api/partner/disposition/${encodeURIComponent(row.reference)}`, {
          method: "PATCH",
          body: JSON.stringify({ assigneeUserId }),
        });
        toast.success(t("dispositionSaved"));
        await refresh();
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : t("dispositionSaveFailed"));
      } finally {
        setBusyRef(null);
      }
    },
    [refresh, t],
  );

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
    pipeline,
    setPipeline,
    reason,
    focus,
    clearFocusFilters,
    counts,
    appointmentValue,
    onDraftDate,
    onAdvance,
    onAssignHandler,
    ensureAssignees,
    assigneesByTenant,
    assigneesLoading,
    refresh,
  };
}
