"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClarificationItemDTO, ClarificationSummaryDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export function useClarificationsList() {
  const { checkPermission } = usePermissions();
  const canView = checkPermission("clarifications:view");
  const canUpdate = checkPermission("inventory:update");

  const [items, setItems] = useState<ClarificationItemDTO[]>([]);
  const [summary, setSummary] = useState<ClarificationSummaryDTO>({
    openCases: 0,
    duplicates: 0,
    derivedClassification: 0,
    missingResponsible: 0,
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await api<{
        summary: ClarificationSummaryDTO;
        items: ClarificationItemDTO[];
      }>("/api/clarifications");
      setSummary(res.summary);
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load clarifications.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { canView, canUpdate, items, summary, loading, refresh };
}
