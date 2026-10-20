"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  DueDateRowDTO,
  DueDatesBoardDTO,
  DueDatesBoardFilter,
  DueDatesConfidenceFilter,
  DueDatesHorizon,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { toast } from "@/store/toastStore";

const FILTERS: DueDatesBoardFilter[] = ["all", "due", "overdue", "unassigned", "open"];
const HORIZONS: DueDatesHorizon[] = [30, 90];

const DUTY_KEYS = [
  "wartung",
  "stk",
  "mtk",
  "abnahme",
  "konstanz",
  "sv",
  "aerztl",
  "nuklear",
  "itsec",
  "install",
  "aufbereitung",
  "kontrolle",
  "validierung",
  "validierung_verweis",
  "einmalprodukt",
  "zubehoer",
  "vernetzung",
  "implantat",
  "dguv",
] as const;

function parseFilter(raw: string | null): DueDatesBoardFilter {
  if (raw && (FILTERS as string[]).includes(raw)) return raw as DueDatesBoardFilter;
  return "all";
}

function parseHorizon(raw: string | null): DueDatesHorizon | null {
  if (!raw) return null;
  const n = Number(raw);
  return (HORIZONS as number[]).includes(n) ? (n as DueDatesHorizon) : null;
}

function parseDutyKey(raw: string | null): string | null {
  if (raw && (DUTY_KEYS as readonly string[]).includes(raw)) return raw;
  return null;
}

function parseConfidence(raw: string | null): DueDatesConfidenceFilter | null {
  if (
    raw === "unverified" ||
    raw === "verified" ||
    raw === "responsible" ||
    raw === "determination" ||
    raw === "derived" ||
    raw === "not_applicable"
  ) {
    return raw;
  }
  return null;
}

const PAGE_LIMIT = 100;

function buildQuery(opts: {
  filter: DueDatesBoardFilter;
  dutyKey: string | null;
  dutyId: string | null;
  horizon: DueDatesHorizon | null;
  confidence: DueDatesConfidenceFilter | null;
  scheduled: boolean;
  q: string;
  offset: number;
}): string {
  const sp = new URLSearchParams();
  if (opts.filter && opts.filter !== "all") sp.set("filter", opts.filter);
  if (opts.dutyId) sp.set("dutyId", opts.dutyId);
  else if (opts.dutyKey) sp.set("dutyKey", opts.dutyKey);
  if (opts.horizon) sp.set("horizon", String(opts.horizon));
  if (opts.confidence) sp.set("confidence", opts.confidence);
  if (opts.scheduled) sp.set("scheduled", "1");
  if (opts.q.trim()) sp.set("q", opts.q.trim());
  sp.set("limit", String(PAGE_LIMIT));
  if (opts.offset > 0) sp.set("offset", String(opts.offset));
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useDueDatesList() {
  const router = useRouter();
  const { checkPermission } = usePermissions();
  const canView = checkPermission("duties:view");
  const canAssign = checkPermission("requests:create");
  const { sync } = useSyncQueryParams();

  const filterParam = useQueryParam("filter");
  const dutyKeyParam = useQueryParam("dutyKey");
  const dutyIdParam = useQueryParam("dutyId");
  const horizonParam = useQueryParam("horizon");
  const confidenceParam = useQueryParam("confidence");
  const scheduledParam = useQueryParam("scheduled");
  const qParam = useQueryParam("q");

  const [board, setBoard] = useState<DueDatesBoardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilterState] = useState<DueDatesBoardFilter>(() => parseFilter(filterParam));
  const [dutyKey, setDutyKeyState] = useState<string | null>(() => parseDutyKey(dutyKeyParam));
  const [horizon, setHorizonState] = useState<DueDatesHorizon | null>(() => parseHorizon(horizonParam));
  const [confidence, setConfidenceState] = useState<DueDatesConfidenceFilter | null>(() =>
    parseConfidence(confidenceParam),
  );
  const [scheduled, setScheduledState] = useState(scheduledParam === "1" || scheduledParam === "true");
  const [q, setQState] = useState(qParam ?? "");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    setFilterState(parseFilter(filterParam));
    setDutyKeyState(parseDutyKey(dutyKeyParam));
    setHorizonState(parseHorizon(horizonParam));
    setConfidenceState(parseConfidence(confidenceParam));
    setScheduledState(scheduledParam === "1" || scheduledParam === "true");
    setQState(qParam ?? "");
  }, [filterParam, dutyKeyParam, dutyIdParam, horizonParam, confidenceParam, scheduledParam, qParam]);

  const setFilter = useCallback(
    (next: DueDatesBoardFilter) => {
      setFilterState(next);
      sync({ filter: next === "all" ? null : next });
    },
    [sync],
  );

  const setDutyKey = useCallback(
    (next: string | null) => {
      setDutyKeyState(next);
      sync({ dutyKey: next, dutyId: null });
    },
    [sync],
  );

  const setHorizon = useCallback(
    (next: DueDatesHorizon | null) => {
      setHorizonState(next);
      sync({ horizon: next == null ? null : String(next) });
    },
    [sync],
  );

  const setConfidence = useCallback(
    (next: DueDatesConfidenceFilter | null) => {
      setConfidenceState(next);
      sync({ confidence: next });
    },
    [sync],
  );

  const setQ = useCallback(
    (next: string) => {
      setQState(next);
      sync({ q: next.trim() || null });
    },
    [sync],
  );

  const clearExtraFilters = useCallback(() => {
    setDutyKeyState(null);
    setHorizonState(null);
    setConfidenceState(null);
    setScheduledState(false);
    sync({ dutyKey: null, dutyId: null, horizon: null, confidence: null, scheduled: null });
  }, [sync]);

  const filterArgs = useCallback(
    () => ({
      filter: parseFilter(filterParam),
      dutyKey: parseDutyKey(dutyKeyParam),
      dutyId: dutyIdParam,
      horizon: parseHorizon(horizonParam),
      confidence: parseConfidence(confidenceParam),
      scheduled: scheduledParam === "1" || scheduledParam === "true",
      q: qParam ?? "",
    }),
    [
      filterParam,
      dutyKeyParam,
      dutyIdParam,
      horizonParam,
      confidenceParam,
      scheduledParam,
      qParam,
    ],
  );

  const refresh = useCallback(async () => {
    if (!canView) {
      setBoard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = buildQuery({ ...filterArgs(), offset: 0 });
      const res = await api<DueDatesBoardDTO>(`/api/due-dates${qs}`);
      setBoard(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load due dates.");
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [canView, filterArgs]);

  const loadMore = useCallback(async () => {
    if (!canView || !board?.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextOffset = board.offset + board.limit;
      const qs = buildQuery({ ...filterArgs(), offset: nextOffset });
      const res = await api<DueDatesBoardDTO>(`/api/due-dates${qs}`);
      setBoard({
        ...res,
        rows: [...board.rows, ...res.rows],
        offset: nextOffset,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load due dates.");
    } finally {
      setLoadingMore(false);
    }
  }, [board, canView, filterArgs, loadingMore]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAssignment = useCallback(
    async (dutyId: string) => {
      setAssigningId(dutyId);
      try {
        const res = await api<{
          created: boolean;
          row: DueDateRowDTO | null;
          request: { reference: string };
        }>(`/api/due-dates/${dutyId}/assign`, { method: "POST", body: JSON.stringify({}) });
        toast.success(
          res.created
            ? `Assignment ${res.request.reference} created.`
            : `Assignment ${res.request.reference} already open.`,
        );
        router.push(`/requests/${encodeURIComponent(res.request.reference)}`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not create assignment.");
      } finally {
        setAssigningId(null);
      }
    },
    [router],
  );

  return {
    canView,
    canAssign,
    loading,
    summary: board?.summary ?? { due: 0, overdue: 0, unassigned: 0, openAssignments: 0 },
    rows: board?.rows ?? [],
    totalMatching: board?.totalMatching ?? 0,
    hasMore: board?.hasMore ?? false,
    loadingMore,
    loadMore,
    filter,
    setFilter,
    dutyKey,
    setDutyKey,
    horizon,
    setHorizon,
    confidence,
    setConfidence,
    scheduled,
    q,
    setQ,
    clearExtraFilters,
    assigningId,
    createAssignment,
    refresh,
  };
}
