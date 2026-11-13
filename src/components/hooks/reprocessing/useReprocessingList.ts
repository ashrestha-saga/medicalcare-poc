"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DeviceInstanceDTO,
  ReprocessingBatchDTO,
  ReprocessingCheckDTO,
  ReprocessingExecutionItemDTO,
  ReprocessingExecutionResponse,
  ReprocessingExecutionStatus,
  RefReprocessingCheckDTO,
  SiteDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

/** Mockup tabs — maps to scope / section query params for dashboard deep-links. */
export type ReprocessingTab = "equipment" | "water" | "sterile" | "batches";

/** Programme = catalogue by check type; Execution = by device/site today. */
export type ReprocessingLens = "programme" | "execution";

export type ExecutionStatusFilter = "all" | ReprocessingExecutionStatus;

/** @deprecated Use ReprocessingTab */
export type ReprocessingSection = "all" | "batches" | "checks";

const TAB_SCOPES: Record<Exclude<ReprocessingTab, "batches">, string> = {
  equipment: "equipment",
  water: "water,chemistry",
  sterile: "sterile_storage",
};

export type ReprocessingEquipmentOption = {
  id: string;
  inventoryNumber: string;
  label: string;
};

export type RecordCheckInput = {
  checkCode: string;
  equipmentDeviceId?: string | null;
  siteId?: string | null;
  batchId?: string | null;
  performedAt: string;
  passed?: boolean | null;
  measuredValue?: string | null;
  note?: string | null;
};

function parseTab(section: string | null, scope: string | null): ReprocessingTab {
  if (section === "batches") return "batches";
  if (scope?.includes("sterile_storage")) return "sterile";
  if (scope?.includes("water") || scope?.includes("chemistry")) return "water";
  return "equipment";
}

function parseLens(
  raw: string | null,
  openToday: boolean,
  tab: ReprocessingTab,
): ReprocessingLens {
  if (tab === "batches") return "programme";
  if (raw === "execution" || raw === "programme") return raw;
  // Deep-link openToday defaults to execution so ops see devices/sites.
  if (openToday) return "execution";
  return "programme";
}

function summarizeExecution(res: ReprocessingExecutionResponse | null) {
  const items = res?.items ?? [];
  const open = items.filter((i) => i.status === "open" || i.status === "partial").length;
  return { n: items.length, open };
}

export function useReprocessingList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("reprocessing:view");
  const canRelease = checkPermission("reprocessing:release");
  const { sync } = useSyncQueryParams();

  const sectionParam = useQueryParam("section");
  const scopeParam = useQueryParam("scope");
  const openTodayParam = useQueryParam("openToday");
  const lensParam = useQueryParam("lens");

  const tab = parseTab(sectionParam, scopeParam);
  const highlightOpenToday = openTodayParam === "1" || openTodayParam === "true";
  const lens = parseLens(lensParam, highlightOpenToday, tab);

  const [checks, setChecks] = useState<ReprocessingCheckDTO[]>([]);
  const [refs, setRefs] = useState<RefReprocessingCheckDTO[]>([]);
  const [allRefs, setAllRefs] = useState<RefReprocessingCheckDTO[]>([]);
  const [openTodayRefs, setOpenTodayRefs] = useState<RefReprocessingCheckDTO[]>([]);
  const [batches, setBatches] = useState<ReprocessingBatchDTO[]>([]);
  const [executionEquip, setExecutionEquip] = useState<ReprocessingExecutionResponse | null>(null);
  const [executionWater, setExecutionWater] = useState<ReprocessingExecutionResponse | null>(null);
  const [executionSterile, setExecutionSterile] = useState<ReprocessingExecutionResponse | null>(
    null,
  );
  /** Subject counts per checks tab when lens=execution (devices or sites). */
  const [executionTabMeta, setExecutionTabMeta] = useState<{
    equipment: { n: number; open: number };
    water: { n: number; open: number };
    sterile: { n: number; open: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<ReprocessingEquipmentOption[]>([]);
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([]);
  const [statusFilter, setStatusFilter] = useState<ExecutionStatusFilter>("all");

  const setTab = useCallback(
    (next: ReprocessingTab) => {
      if (next === "batches") {
        sync({
          section: "batches",
          scope: null,
          openToday: null,
          cadence: null,
          lens: null,
        });
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

  const setOpenToday = useCallback(
    (next: boolean) => {
      sync({
        openToday: next ? "1" : null,
        lens: next ? "execution" : lensParam === "execution" ? "execution" : null,
      });
      if (next) setStatusFilter("open");
      else setStatusFilter("all");
    },
    [sync, lensParam],
  );

  const setLens = useCallback(
    (next: ReprocessingLens) => {
      if (tab === "batches") return;
      sync({ lens: next === "programme" ? null : next });
    },
    [sync, tab],
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
      setExecutionEquip(null);
      setExecutionWater(null);
      setExecutionSterile(null);
      setExecutionTabMeta(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const tabScope = tab === "batches" ? null : TAB_SCOPES[tab];
      const tabQs = tabScope ? `?scope=${encodeURIComponent(tabScope)}` : "";
      const needExecution = lens === "execution";
      const fetchExec = (scope: string) =>
        api<ReprocessingExecutionResponse>(
          `/api/reprocessing/execution?scope=${encodeURIComponent(scope)}`,
        );
      const [cOpen, cTab, cAll, b, execEquip, execWater, execSterile] = await Promise.all([
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
        needExecution ? fetchExec(TAB_SCOPES.equipment) : Promise.resolve(null),
        needExecution ? fetchExec(TAB_SCOPES.water) : Promise.resolve(null),
        needExecution ? fetchExec(TAB_SCOPES.sterile) : Promise.resolve(null),
      ]);
      setOpenTodayRefs(cOpen.openToday ?? []);
      setChecks(cAll.checks);
      setRefs(cTab.refs);
      setAllRefs(cAll.refs);
      setBatches(b.batches);
      if (needExecution) {
        setExecutionEquip(execEquip);
        setExecutionWater(execWater);
        setExecutionSterile(execSterile);
        setExecutionTabMeta({
          equipment: summarizeExecution(execEquip),
          water: summarizeExecution(execWater),
          sterile: summarizeExecution(execSterile),
        });
      } else {
        setExecutionEquip(null);
        setExecutionWater(null);
        setExecutionSterile(null);
        setExecutionTabMeta(null);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load reprocessing data.");
    } finally {
      setLoading(false);
    }
  }, [canView, tab, lens]);

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

  /** Distinct devices (or sites) with evidence dated today per check code. */
  const todaySubjectCountByCode = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map = new Map<string, Set<string>>();
    for (const c of checks) {
      if (c.performedAt.slice(0, 10) !== today) continue;
      const key = c.equipmentDeviceId ?? c.siteId;
      if (!key) continue;
      let set = map.get(c.checkCode);
      if (!set) {
        set = new Set();
        map.set(c.checkCode, set);
      }
      set.add(key);
    }
    const counts = new Map<string, number>();
    for (const [code, set] of map) counts.set(code, set.size);
    return counts;
  }, [checks]);

  const openTodayCodes = useMemo(() => new Set(openTodayRefs.map((r) => r.code)), [openTodayRefs]);

  const displayRefs = useMemo(
    () => (highlightOpenToday ? refs.filter((r) => openTodayCodes.has(r.code)) : refs),
    [highlightOpenToday, refs, openTodayCodes],
  );

  const execution = useMemo(() => {
    if (tab === "water") return executionWater;
    if (tab === "sterile") return executionSterile;
    return executionEquip;
  }, [tab, executionEquip, executionWater, executionSterile]);

  const executionItems = useMemo(() => {
    const items = execution?.items ?? [];
    if (statusFilter === "all") return items;
    return items.filter((i) => i.status === statusFilter);
  }, [execution, statusFilter]);

  const executionOpenCount = useMemo(
    () =>
      (execution?.items ?? []).filter((i) => i.status === "open" || i.status === "partial").length,
    [execution],
  );

  // Deep-link `?openToday=1` without a tab: land on the first tab that has open daily checks.
  const openTodayTabRef = useRef(false);
  useEffect(() => {
    if (!highlightOpenToday || loading || openTodayTabRef.current) return;
    openTodayTabRef.current = true;
    if (sectionParam || scopeParam || openTodayRefs.length === 0) return;
    const hasScope = (scopes: string[]) => openTodayRefs.some((r) => scopes.includes(r.scope));
    const next = hasScope(["equipment"])
      ? null
      : hasScope(["water", "chemistry"])
        ? "water"
        : hasScope(["sterile_storage"])
          ? "sterile"
          : null;
    if (next) sync({ section: "checks", scope: TAB_SCOPES[next], lens: "execution" });
    else sync({ lens: "execution" });
    setStatusFilter("open");
  }, [highlightOpenToday, loading, sectionParam, scopeParam, openTodayRefs, sync]);

  /** Lazy-load pickers for the record dialog (equipment devices, sites). */
  const loadRecordOptions = useCallback(async () => {
    const [devRes, siteRes] = await Promise.all([
      api<{ devices: DeviceInstanceDTO[] }>("/api/devices").catch(() => null),
      api<{ sites: SiteDTO[] }>("/api/sites").catch(() => null),
    ]);
    setEquipment(
      (devRes?.devices ?? [])
        .filter((d) => d.isReprocessingEquipment && d.state !== "retired")
        .map((d) => ({
          id: d.id,
          inventoryNumber: d.inventoryNumber,
          label: d.tradeName || d.modelName || d.inventoryNumber,
        })),
    );
    setSites((siteRes?.sites ?? []).map((site) => ({ id: site.id, name: site.name })));
  }, []);

  const recordCheck = useCallback(
    async (input: RecordCheckInput) => {
      try {
        await api("/api/reprocessing/checks", { method: "POST", body: JSON.stringify(input) });
        toast.success("Check recorded");
        await refresh();
        return true;
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not record check.");
        return false;
      }
    },
    [refresh],
  );

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
    lens,
    setLens,
    checks,
    refs: displayRefs,
    allRefs,
    openTodayRefs,
    batches,
    latestByCode,
    todaySubjectCountByCode,
    execution,
    executionItems,
    executionOpenCount,
    executionTabMeta,
    statusFilter,
    setStatusFilter,
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
    setOpenToday,
    equipment,
    sites,
    loadRecordOptions,
    recordCheck,
    clearCheckFilters: () => undefined,
  };
}

export type { ReprocessingExecutionItemDTO };
