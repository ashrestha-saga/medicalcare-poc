"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ClarificationIssueCode,
  ClarificationItemDTO,
  ClarificationSeverity,
  ClarificationSummaryDTO,
} from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

const ISSUE_CODES: ClarificationIssueCode[] = [
  "missing_responsible",
  "missing_maintenance_cycle",
  "missing_classification",
  "derived_classification",
  "missing_room",
  "missing_model_name",
  "missing_serial",
  "duplicate_serial",
  "not_released",
];

const SEVERITIES: ClarificationSeverity[] = ["high", "medium", "low"];

function parseIssue(raw: string | null): ClarificationIssueCode | null {
  if (raw && (ISSUE_CODES as string[]).includes(raw)) return raw as ClarificationIssueCode;
  return null;
}

function parseSeverity(raw: string | null): ClarificationSeverity | null {
  if (raw && (SEVERITIES as string[]).includes(raw)) return raw as ClarificationSeverity;
  return null;
}

export function useClarificationsList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("clarifications:view");
  const canUpdate = checkPermission("inventory:update");
  const { sync } = useSyncQueryParams();

  const issueParam = useQueryParam("issue");
  const severityParam = useQueryParam("severity");
  const issue = parseIssue(issueParam);
  const severity = parseSeverity(severityParam);

  const [allItems, setAllItems] = useState<ClarificationItemDTO[]>([]);
  const [summary, setSummary] = useState<ClarificationSummaryDTO>({
    openCases: 0,
    duplicates: 0,
    derivedClassification: 0,
    missingResponsible: 0,
  });
  const [loading, setLoading] = useState(false);

  const setIssue = useCallback(
    (next: ClarificationIssueCode | null) => {
      sync({ issue: next });
    },
    [sync],
  );

  const setSeverity = useCallback(
    (next: ClarificationSeverity | null) => {
      sync({ severity: next });
    },
    [sync],
  );

  const clearFilters = useCallback(() => {
    sync({ issue: null, severity: null });
  }, [sync]);

  const refresh = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await api<{
        summary: ClarificationSummaryDTO;
        items: ClarificationItemDTO[];
      }>("/api/clarifications");
      setSummary(res.summary);
      setAllItems(res.items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load clarifications.");
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = useMemo(() => {
    return allItems.filter((item) => {
      if (issue && !item.issues.some((x) => x.code === issue)) return false;
      if (severity && item.severity !== severity) return false;
      return true;
    });
  }, [allItems, issue, severity]);

  return {
    canView,
    canUpdate,
    items,
    summary,
    loading,
    refresh,
    issue,
    setIssue,
    severity,
    setSeverity,
    clearFilters,
  };
}
