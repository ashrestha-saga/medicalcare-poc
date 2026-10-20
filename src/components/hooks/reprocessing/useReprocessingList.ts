"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ReprocessingBatchDTO,
  ReprocessingCheckDTO,
  RefReprocessingCheckDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

/** Mockup tabs — maps to scope / section query params for dashboard deep-links. */
export type ReprocessingTab = "equipment" | "water" | "sterile" | "batches";

/** @deprecated Use ReprocessingTab */
export type ReprocessingSection = "all" | "batches" | "checks";

const TAB_SCOPES: Record<Exclude<ReprocessingTab, "batches">, string> = {
  equipment: "equipment",
  water: "water,chemistry",
  sterile: "sterile_storage",
};

function parseTab(section: string | null, scope: string | null): ReprocessingTab {
  if (section === "batches") return "batches";
  if (scope?.includes("sterile_storage")) return "sterile";
  if (scope?.includes("water") || scope?.includes("chemistry")) return "water";
  return "equipment";
}

export function useReprocessingList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("reprocessing:view");
  const canRelease = checkPermission("reprocessing:release");
  const { sync } = useSyncQueryParams();

  const sectionParam = useQueryParam("section");
  const scopeParam = useQueryParam("scope");
  const openTodayParam = useQueryParam("openToday");

  const tab = parseTab(sectionParam, scopeParam);
  const highlightOpenToday = openTodayParam === "1" || openTodayParam === "true";

  const [checks, setChecks] = useState<ReprocessingCheckDTO[]>([]);
  const [refs, setRefs] = useState<RefReprocessingCheckDTO[]>([]);
  const [allRefs, setAllRefs] = useState<RefReprocessingCheckDTO[]>([]);
  const [openTodayRefs, setOpenTodayRefs] = useState<RefReprocessingCheckDTO[]>([]);
  const [batches, setBatches] = useState<ReprocessingBatchDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const setTab = useCallback(
    (next: ReprocessingTab) => {
      if (next === "batches") {
        sync({ section: "batches", scope: null, openToday: null, cadence: null });
        return;
      }
      sync({
        section: "checks",
        scope: TAB_SCOPES[next],
        openToday: null,
        cadence: null,
      });
    },
    [sync],
  );

  const setSection = useCallback(
    (next: ReprocessingSection) => {
      if (next === "batches") setTab("batches");
      else setTab("equipment");
    },
    [setTab],
  );

  const refresh = useCallback(async () => {
    if (!canView) {
      setChecks([]);
      setRefs([]);
      setAllRefs([]);
      setBatches([]);
      setOpenTodayRefs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const tabScope = tab === "batches" ? null : TAB_SCOPES[tab];
      const tabQs = tabScope ? `?scope=${encodeURIComponent(tabScope)}` : "";
      const [cOpen, cTab, cAll, b] = await Promise.all([
        api<{
          checks: ReprocessingCheckDTO[];
          refs: RefReprocessingCheckDTO[];
          openToday?: RefReprocessingCheckDTO[];
        }>("/api/reprocessing/checks?openToday=1&cadence=daily"),
        api<{
          checks: ReprocessingCheckDTO[];
          refs: RefReprocessingCheckDTO[];
        }>(`/api/reprocessing/checks${tabQs}`),
        api<{
          checks: ReprocessingCheckDTO[];
          refs: RefReprocessingCheckDTO[];
        }>("/api/reprocessing/checks"),
        api<{ batches: ReprocessingBatchDTO[] }>("/api/reprocessing/batches"),
      ]);
      setOpenTodayRefs(cOpen.openToday ?? []);
      setChecks(cAll.checks);
      setRefs(cTab.refs);
      setAllRefs(cAll.refs);
      setBatches(b.batches);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load reprocessing data.");
    } finally {
      setLoading(false);
    }
  }, [canView, tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const release = useCallback(
    async (
      id: string,
      releaseResult: "released" | "released_with_conditions" | "rejected",
      releaseNote?: string | null,
    ) => {
      await api(`/api/reprocessing/batches/${id}/release`, {
        method: "POST",
        body: JSON.stringify({ releaseResult, releaseNote: releaseNote ?? null }),
      });
      toast.success("Batch release recorded");
      await refresh();
    },
    [refresh],
  );

  const latestByCode = useMemo(() => {
    const map = new Map<string, ReprocessingCheckDTO>();
    for (const c of checks) {
      const prev = map.get(c.checkCode);
      if (!prev || c.performedAt > prev.performedAt) map.set(c.checkCode, c);
    }
    return map;
  }, [checks]);

  const unevaluatedCount = useMemo(
    () =>
      checks.filter(
        (c) => c.measuredValue != null && c.measuredValue !== "" && c.withinLimit == null,
      ).length,
    [checks],
  );

  return {
    canView,
    canRelease,
    tab,
    setTab,
    checks,
    refs,
    allRefs,
    openTodayRefs,
    batches,
    latestByCode,
    loading,
    refresh,
    release,
    highlightOpenToday,
    unevaluatedCount,
    section: (tab === "batches" ? "batches" : "checks") as ReprocessingSection,
    setSection,
    cadence: null as string | null,
    setCadence: (_next: string | null) => undefined,
    scope: tab === "batches" ? null : TAB_SCOPES[tab],
    setScope: (_next: string | null) => undefined,
    openToday: highlightOpenToday,
    setOpenToday: (_next: boolean) => undefined,
    clearCheckFilters: () => undefined,
  };
}
