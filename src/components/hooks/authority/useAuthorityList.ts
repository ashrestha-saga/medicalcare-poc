"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AuthorityFindingDTO,
  AuthorityInspectionDTO,
  AuthorityNotificationDTO,
  BegehGapDTO,
  ChecklistPrepDTO,
  DisclosureSessionDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export type BegehMode = "vorbereitung" | "begehung";
export type BegehTab = "luecken" | "mappe" | "befunde" | "notifications" | "disclosure";

function parseMode(raw: string | null): BegehMode {
  return raw === "begehung" ? "begehung" : "vorbereitung";
}

function parseTab(raw: string | null): BegehTab {
  if (
    raw === "mappe" ||
    raw === "befunde" ||
    raw === "notifications" ||
    raw === "disclosure" ||
    raw === "luecken"
  ) {
    return raw;
  }
  return "luecken";
}

export function useAuthorityList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("authority:view");
  const { sync } = useSyncQueryParams();

  const modeParam = useQueryParam("mode");
  const tabParam = useQueryParam("tab");
  const checklistParam = useQueryParam("checklist");
  const findingIdParam = useQueryParam("findingId");

  const mode = parseMode(modeParam);
  const tab = parseTab(tabParam);

  const [inspections, setInspections] = useState<AuthorityInspectionDTO[]>([]);
  const [findings, setFindings] = useState<AuthorityFindingDTO[]>([]);
  const [notifications, setNotifications] = useState<AuthorityNotificationDTO[]>([]);
  const [checklists, setChecklists] = useState<ChecklistPrepDTO[]>([]);
  const [sessions, setSessions] = useState<DisclosureSessionDTO[]>([]);
  const [gaps, setGaps] = useState<BegehGapDTO[]>([]);
  const [prepMeta, setPrepMeta] = useState({
    openFindings: 0,
    overdueFindings: 0,
    remediatedUnproven: 0,
  });
  const [loading, setLoading] = useState(true);

  const setMode = useCallback(
    (next: BegehMode) => {
      sync({ mode: next === "vorbereitung" ? null : next });
    },
    [sync],
  );

  const setTab = useCallback(
    (next: BegehTab) => {
      sync({ tab: next === "luecken" ? null : next });
    },
    [sync],
  );

  const setChecklist = useCallback(
    (code: string | null) => {
      sync({ checklist: code });
    },
    [sync],
  );

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
      const [i, f, n, s, prep] = await Promise.all([
        api<{ inspections: AuthorityInspectionDTO[] }>("/api/authority/inspections"),
        api<{ findings: AuthorityFindingDTO[] }>(`/api/authority/findings${findingsQs}`),
        api<{ notifications: AuthorityNotificationDTO[] }>("/api/authority/notifications"),
        api<{ sessions: DisclosureSessionDTO[] }>("/api/authority/disclosure"),
        api<{
          prep: {
            gaps: BegehGapDTO[];
            openFindings: number;
            overdueFindings: number;
            remediatedUnproven: number;
          };
          checklists: ChecklistPrepDTO[];
        }>("/api/authority/prep"),
      ]);
      setInspections(i.inspections);
      setFindings(f.findings);
      setNotifications(n.notifications);
      setSessions(s.sessions);
      setGaps(prep.prep.gaps);
      setPrepMeta({
        openFindings: prep.prep.openFindings,
        overdueFindings: prep.prep.overdueFindings,
        remediatedUnproven: prep.prep.remediatedUnproven,
      });
      setChecklists(prep.checklists);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load authority data.");
    } finally {
      setLoading(false);
    }
  }, [canView, findingIdParam]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      toast.success("Finding marked remediated");
      await refresh();
    },
    [refresh],
  );

  const openDisclosure = useCallback(
    async (input: {
      expiresAt: string;
      audience: string;
      purpose?: string | null;
      scope: string[];
    }) => {
      await api("/api/authority/disclosure", {
        method: "POST",
        body: JSON.stringify(input),
      });
      toast.success("Disclosure session opened");
      await refresh();
    },
    [refresh],
  );

  const closeDisclosure = useCallback(
    async (id: string) => {
      await api(`/api/authority/disclosure/${id}/close`, { method: "POST", body: "{}" });
      toast.success("Disclosure session closed");
      await refresh();
    },
    [refresh],
  );

  const activeChecklist =
    checklists.find((c) => c.code === checklistParam) ?? checklists[0] ?? null;

  return {
    canView,
    mode,
    setMode,
    tab,
    setTab,
    inspections,
    findings,
    notifications,
    checklists,
    activeChecklist,
    setChecklist,
    sessions,
    gaps,
    prepMeta,
    loading,
    refresh,
    remediate,
    openDisclosure,
    closeDisclosure,
  };
}
