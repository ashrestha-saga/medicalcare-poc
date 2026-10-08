"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DueDateRowDTO, DueDatesBoardDTO, DueDatesBoardFilter } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

function matchesFilter(row: DueDateRowDTO, filter: DueDatesBoardFilter): boolean {
  if (filter === "all") return true;
  if (filter === "due") return row.status === "due" || row.status === "ok";
  if (filter === "overdue") return row.status === "overdue";
  if (filter === "unassigned") return row.assignment == null;
  return row.assignment != null;
}

export function useDueDatesList() {
  const router = useRouter();
  const { checkPermission } = usePermissions();
  const canView = checkPermission("duties:view");
  const canAssign = checkPermission("requests:create");

  const [board, setBoard] = useState<DueDatesBoardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DueDatesBoardFilter>("all");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!canView) {
      setBoard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api<DueDatesBoardDTO>("/api/due-dates");
      setBoard(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load due dates.");
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows = useMemo(() => {
    const list = board?.rows ?? [];
    return list.filter((row) => matchesFilter(row, filter));
  }, [board, filter]);

  const createAssignment = useCallback(async (dutyId: string) => {
    setAssigningId(dutyId);
    try {
      const res = await api<{ created: boolean; row: DueDateRowDTO | null; request: { reference: string } }>(
        `/api/due-dates/${dutyId}/assign`,
        { method: "POST", body: JSON.stringify({}) },
      );
      toast.success(
        res.created ? `Assignment ${res.request.reference} created.` : `Assignment ${res.request.reference} already open.`,
      );
      router.push(`/requests/${encodeURIComponent(res.request.reference)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create assignment.");
    } finally {
      setAssigningId(null);
    }
  }, [router]);

  return {
    canView,
    canAssign,
    loading,
    summary: board?.summary ?? { due: 0, overdue: 0, unassigned: 0, openAssignments: 0 },
    rows,
    filter,
    setFilter,
    assigningId,
    createAssignment,
    refresh,
  };
}
