"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  AuthorityFindingDTO,
  AuthorityInspectionDTO,
  AuthorityNotificationDTO,
  AuthorityOverviewDTO,
  ChecklistPrepDTO,
  DisclosedEventDTO,
  DisclosureCloseSummaryDTO,
  DisclosureSessionDTO,
  PreparationListDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export type BegehTab = "vorbereitung" | "begehungen" | "sitzungen" | "notifications";
export type PrepFilter = "all" | "bereit" | "luecke" | "aussen";
export type FindingFilter =
  | "all"
  | "offen"
  | "ueberfaellig"
  | "behoben"
  | "nachgewiesen"
  | "bestritten";

/** Legacy aliases kept for deep links from older tiles. */
export type BegehMode = "vorbereitung" | "begehung";

function parseTab(raw: string | null): BegehTab {
  if (raw === "begehungen" || raw === "befunde") return "begehungen";
  if (raw === "sitzungen" || raw === "disclosure") return "sitzungen";
  if (raw === "notifications") return "notifications";
  if (raw === "luecken" || raw === "mappe" || raw === "vorbereitung") return "vorbereitung";
  return "vorbereitung";
}

function parsePrepFilter(raw: string | null): PrepFilter {
  if (raw === "bereit" || raw === "luecke" || raw === "aussen") return raw;
  return "all";
}

function parseFindingFilter(raw: string | null): FindingFilter {
  if (
    raw === "offen" ||
    raw === "ueberfaellig" ||
    raw === "behoben" ||
    raw === "nachgewiesen" ||
    raw === "bestritten"
  ) {
    return raw;
  }
  if (raw === "open") return "offen";
  if (raw === "remediated") return "behoben";
  return "all";
}

export function useAuthorityList() {
  const t = useTranslations("pages.authority");
  const { checkPermission } = usePermissions();
  const canView = checkPermission("authority:view");
  const canManage = checkPermission("authority:manage");
  const { sync } = useSyncQueryParams();

  const tabParam = useQueryParam("tab");
  const listParam = useQueryParam("list");
  const checklistParam = useQueryParam("checklist");
  const filterParam = useQueryParam("filter");
  const siteParam = useQueryParam("site");
  const findingIdParam = useQueryParam("findingId");
  const resolvedListParam = listParam ?? checklistParam;

  const tab = parseTab(tabParam);
  const prepFilter = parsePrepFilter(filterParam);
  const findingFilter = parseFindingFilter(filterParam);

  const [inspections, setInspections] = useState<AuthorityInspectionDTO[]>([]);
  const [findings, setFindings] = useState<AuthorityFindingDTO[]>([]);
  const [notifications, setNotifications] = useState<AuthorityNotificationDTO[]>([]);
  const [checklists, setChecklists] = useState<ChecklistPrepDTO[]>([]);
  const [sessions, setSessions] = useState<DisclosureSessionDTO[]>([]);
  const [preparation, setPreparation] = useState<PreparationListDTO | null>(null);
  const [overview, setOverview] = useState<AuthorityOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const setTab = useCallback(
    (next: BegehTab) => {
      sync({ tab: next === "vorbereitung" ? null : next, filter: null });
    },
    [sync],
  );

  /** One URL write for KPI tiles — setTab+setFilter race and drop either tab or filter. */
  const goTo = useCallback(
    (nextTab: BegehTab, nextFilter: string | null) => {
      sync({
        tab: nextTab === "vorbereitung" ? null : nextTab,
        filter: nextFilter === "all" || !nextFilter ? null : nextFilter,
      });
    },
    [sync],
  );

  const setList = useCallback(
    (code: string | null) => {
      sync({ list: code, checklist: null });
    },
    [sync],
  );

  const setFilter = useCallback(
    (next: string | null) => {
      sync({ filter: next === "all" || !next ? null : next });
    },
    [sync],
  );

  const setSite = useCallback(
    (id: string | null) => {
      sync({ site: id });
    },
    [sync],
  );

  const activeListCode = resolvedListParam ?? checklists[0]?.code ?? "CL-MP-DE";

  const refresh = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const findingsQs = findingIdParam
        ? `?findingId=${encodeURIComponent(findingIdParam)}`
        : "";
      const listQs = encodeURIComponent(activeListCode);
      const siteQs = siteParam ? `&site=${encodeURIComponent(siteParam)}` : "";
      const [i, f, n, s, prepLegacy, overviewRes, preparationRes] = await Promise.all([
        api<{ inspections: AuthorityInspectionDTO[] }>("/api/authority/inspections"),
        api<{ findings: AuthorityFindingDTO[] }>(`/api/authority/findings${findingsQs}`),
        api<{ notifications: AuthorityNotificationDTO[] }>("/api/authority/notifications"),
        api<{ sessions: DisclosureSessionDTO[] }>("/api/authority/disclosure"),
        api<{ checklists: ChecklistPrepDTO[] }>("/api/authority/prep"),
        api<AuthorityOverviewDTO>(`/api/authority/overview?list=${listQs}${siteQs}`),
        api<PreparationListDTO>(`/api/authority/preparation?list=${listQs}`),
      ]);
      setInspections(i.inspections);
      setFindings(f.findings);
      setNotifications(n.notifications);
      setSessions(s.sessions);
      setChecklists(prepLegacy.checklists);
      setOverview(overviewRes);
      setPreparation(preparationRes);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("toast.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [canView, findingIdParam, activeListCode, siteParam, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.active) ?? null,
    [sessions],
  );

  const remediate = useCallback(
    async (id: string, remediationNote: string, opts?: { notifyRecipient?: string | null }) => {
      await api(`/api/authority/findings/${id}/remediate`, {
        method: "POST",
        body: JSON.stringify({
          remediationNote,
          remediatedAt: new Date().toISOString().slice(0, 10),
          notifyRecipient: opts?.notifyRecipient ?? null,
        }),
      });
      toast.success(t("toast.remediated"));
      await refresh();
    },
    [refresh, t],
  );

  const prove = useCallback(
    async (id: string, provenAt: string) => {
      await api(`/api/authority/findings/${id}/prove`, {
        method: "POST",
        body: JSON.stringify({ provenAt }),
      });
      toast.success(t("toast.proven"));
      await refresh();
    },
    [refresh, t],
  );

  const dispute = useCallback(
    async (id: string, disputedReason: string) => {
      await api(`/api/authority/findings/${id}/dispute`, {
        method: "POST",
        body: JSON.stringify({ disputedReason }),
      });
      toast.success(t("toast.disputed"));
      await refresh();
    },
    [refresh, t],
  );

  const openDisclosure = useCallback(
    async (input: {
      durationMinutes?: number;
      expiresAt?: string;
      audience: string;
      purpose?: string | null;
      scope: string[];
      siteId?: string | null;
      checklistCode?: string | null;
      participants?: string | null;
    }) => {
      await api("/api/authority/disclosure", {
        method: "POST",
        body: JSON.stringify(input),
      });
      toast.success(t("toast.sessionOpened"));
      await refresh();
    },
    [refresh, t],
  );

  const closeDisclosure = useCallback(
    async (id: string): Promise<DisclosureCloseSummaryDTO> => {
      const summary = await api<DisclosureCloseSummaryDTO>(
        `/api/authority/disclosure/${id}/close`,
        { method: "POST", body: "{}" },
      );
      toast.success(t("toast.sessionClosed"));
      await refresh();
      return summary;
    },
    [refresh, t],
  );

  const listDisclosed = useCallback(async (sessionId: string): Promise<DisclosedEventDTO[]> => {
    const res = await api<{ disclosed: DisclosedEventDTO[] }>(
      `/api/authority/sessions/${sessionId}/disclosed`,
    );
    return res.disclosed;
  }, []);

  const recordShown = useCallback(
    async (sessionId: string, input: { resource: string; resourceId?: string | null; label: string }) => {
      try {
        await api(`/api/authority/sessions/${sessionId}/disclosed`, {
          method: "POST",
          body: JSON.stringify(input),
        });
      } catch {
        /* non-blocking protocol */
      }
    },
    [],
  );

  const setReadiness = useCallback(
    async (itemId: string, externalReady: boolean, documentRef?: string | null) => {
      await api(`/api/authority/readiness/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({ externalReady, documentRef: documentRef ?? null }),
      });
      toast.success(externalReady ? t("toast.readinessSet") : t("toast.readinessCleared"));
      await refresh();
    },
    [refresh, t],
  );

  const createInspection = useCallback(
    async (input: {
      authorityName: string;
      authorityKind:
        | "health_office"
        | "device_authority"
        | "occupational_safety"
        | "metrology"
        | "medical_board"
        | "other";
      visitedAt: string;
      siteId?: string | null;
      checklistCode?: string | null;
      announcedAt?: string | null;
      protocolReceivedAt?: string | null;
      protocolRef?: string | null;
      feeEur?: number | null;
      legalBasis?: string | null;
      disclosureSessionId?: string | null;
      note?: string | null;
    }) => {
      const res = await api<{ inspection: { id: string } }>("/api/authority/inspections", {
        method: "POST",
        body: JSON.stringify(input),
      });
      toast.success(t("toast.inspectionRecorded"));
      await refresh();
      return res.inspection.id;
    },
    [refresh, t],
  );

  const addFinding = useCallback(
    async (
      inspectionId: string,
      input: {
        itemNo?: string | null;
        description: string;
        legalBasis?: string | null;
        dueAt?: string | null;
        deviceInstanceId?: string | null;
      },
    ) => {
      await api(`/api/authority/inspections/${inspectionId}/findings`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      toast.success(t("toast.findingAdded"));
      await refresh();
    },
    [refresh, t],
  );

  const filteredFindings = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const listAuthorityKind = checklists.find((c) => c.code === activeListCode)?.authorityKind;
    return findings.filter((f) => {
      const insp = inspections.find((i) => i.id === f.inspectionId);
      const matchesList =
        insp?.checklistCode === activeListCode ||
        (!insp?.checklistCode &&
          Boolean(listAuthorityKind) &&
          insp?.authorityKind === listAuthorityKind);
      if (!matchesList) return false;
      if (findingFilter === "offen") return f.status === "open";
      if (findingFilter === "ueberfaellig")
        return f.status === "open" && Boolean(f.dueAt && f.dueAt < today);
      if (findingFilter === "behoben") return f.status === "remediated";
      if (findingFilter === "nachgewiesen") return f.status === "proven";
      if (findingFilter === "bestritten") return f.status === "disputed";
      return true;
    });
  }, [findings, findingFilter, inspections, activeListCode, checklists]);

  const activeChecklist =
    checklists.find((c) => c.code === activeListCode) ?? checklists[0] ?? null;

  return {
    canView,
    canManage,
    tab,
    setTab,
    goTo,
    /** @deprecated mode removed in v26.1 — kept for compile compatibility */
    mode: "vorbereitung" as BegehMode,
    setMode: (_: BegehMode) => undefined,
    prepFilter,
    findingFilter,
    setFilter,
    inspections,
    findings: filteredFindings,
    allFindings: findings,
    notifications,
    checklists,
    activeChecklist,
    activeListCode,
    setChecklist: setList,
    setList,
    siteId: siteParam,
    setSite,
    sessions,
    activeSession,
    preparation,
    overview,
    gaps: preparation?.unmapped.map((u) => ({
      count: u.count,
      label: u.label,
      href: u.target,
    })) ?? [],
    prepMeta: {
      openFindings: overview?.findingsOpen ?? 0,
      overdueFindings: filteredFindings.filter((f) => f.status === "open" && f.dueAt).length,
      remediatedUnproven: overview?.findingsRemediated ?? 0,
    },
    loading,
    refresh,
    remediate,
    prove,
    dispute,
    openDisclosure,
    closeDisclosure,
    listDisclosed,
    recordShown,
    setReadiness,
    createInspection,
    addFinding,
  };
}
