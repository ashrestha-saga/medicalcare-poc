"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { CataloguePreviewDTO } from "@/interfaces/pruefpartner";
import { api, ApiError } from "@/lib/http/apiClient";
import { useActingTenantStore } from "@/store/actingTenantStore";
import { useInspectQueueStore } from "@/store/inspectQueueStore";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { useSessionStore } from "@/store/sessionStore";

/** Hydrates Meine Aufträge from the portal queue + resolve API. */
export function useAssignmentQueue() {
  const t = useTranslations("pruefpartner");
  const sessionUserId = useSessionStore((s) => s.user?.id);
  const queueUserId = useInspectQueueStore((s) => s.userId);
  const tenantId = useInspectQueueStore((s) => s.tenantId);
  const tenantName = useInspectQueueStore((s) => s.tenantName);
  const references = useInspectQueueStore((s) => s.references);
  const doneReferences = useInspectQueueStore((s) => s.doneReferences);
  const clearQueue = useInspectQueueStore((s) => s.clear);
  const retainReferences = useInspectQueueStore((s) => s.retainReferences);
  const setActingTenant = useActingTenantStore((s) => s.setActingTenant);
  const inspectionQueue = useOfflineQueueStore((s) => s.inspectionQueue);
  const loadQueue = useOfflineQueueStore((s) => s.load);
  const replay = useOfflineQueueStore((s) => s.replay);

  const [rows, setRows] = useState<CataloguePreviewDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  // Drop a colleague's persisted queue when another user opens inspect.
  useEffect(() => {
    if (!sessionUserId || !queueUserId) return;
    if (queueUserId !== sessionUserId) clearQueue();
  }, [sessionUserId, queueUserId, clearQueue]);

  useEffect(() => {
    if (!tenantId) return;
    setActingTenant({ tenantId, tenantName: tenantName ?? tenantId });
  }, [tenantId, tenantName, setActingTenant]);

  const hydrate = useCallback(async () => {
    if (!tenantId || references.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    setActingTenant({ tenantId, tenantName: tenantName ?? tenantId });
    setLoading(true);
    setError(null);
    try {
      const settled = await Promise.all(
        references.map(async (ref) => {
          try {
            const row = await api<CataloguePreviewDTO>(
              `/api/partner/inspection-runs/resolve?reference=${encodeURIComponent(ref)}`,
            );
            return { ref, row };
          } catch (e) {
            // 403 = not assigned to this user — drop quietly from Heute.
            if (e instanceof ApiError && e.status === 403) return { ref, row: null };
            throw e;
          }
        }),
      );
      const allowed = settled.filter((s) => s.row != null) as {
        ref: string;
        row: CataloguePreviewDTO;
      }[];
      if (allowed.length !== references.length) {
        retainReferences(allowed.map((s) => s.ref));
      }
      setRows(allowed.map((s) => s.row));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenantName, references, setActingTenant, retainReferences, t]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const openRows = rows.filter((r) => !r.sealed && !doneReferences.includes(r.reference));
  const doneRows = rows.filter((r) => r.sealed || doneReferences.includes(r.reference));

  return {
    tenantId,
    tenantName,
    references,
    rows,
    openRows,
    doneRows,
    loading,
    error,
    inspectionQueue,
    replay,
    hydrate,
  };
}
