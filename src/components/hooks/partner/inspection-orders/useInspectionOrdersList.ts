"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleRequestListDTO, ConsoleRequestRowDTO } from "@/interfaces/console";
import { toDatetimeLocalValue } from "@/lib/format";
import { api, ApiError } from "@/lib/http/apiClient";
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

function pipelineBucket(row: ConsoleRequestRowDTO): DispatchPipelineFilter {
  if (row.displayState === "abgeschlossen" || row.displayState === "abgelehnt") return "done";
  if (row.displayState === "in_arbeit") return "in_progress";
  if (row.displayState === "terminiert") return "scheduled";
  if (row.displayState === "zugewiesen") return "needs_appointment";
  return "needs_handler";
}

/** Partner console — Our dispatch (executor queue: handler, appointment, advance). */
export function useInspectionOrdersList() {
  const t = useTranslations("console");
  const [rows, setRows] = useState<ConsoleRequestRowDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [draftDates, setDraftDates] = useState<Record<string, string>>({});
  const [pipeline, setPipelineRaw] = useState<DispatchPipelineFilter>("all");
  const [assigneesByTenant, setAssigneesByTenant] = useState<
    Record<string, DispatchAssignee[]>
  >({});
  const assigneesCacheRef = useRef(assigneesByTenant);
  assigneesCacheRef.current = assigneesByTenant;
  const [assigneesLoading, setAssigneesLoading] = useState<string | null>(null);

  const setPipeline = useCallback((value: string) => {
    const parsed = dispatchPipelineFilterSchema.safeParse(value);
    if (parsed.success) setPipelineRaw(parsed.data);
  }, []);

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
    const byPipe =
      pipeline === "all" ? rows : rows.filter((row) => pipelineBucket(row) === pipeline);
    const q = keyword.trim().toLowerCase();
    if (!q) return byPipe;
    return byPipe.filter((row) =>
      [
        row.reference,
        row.tenantName,
        row.deviceLabel,
        row.deviceDetail ?? "",
        row.serviceType,
        row.assigneeName ?? "",
        row.displayState,
        row.managed ? "managed" : "external",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, keyword, pipeline]);

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
