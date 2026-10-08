"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CataloguePreviewDTO } from "@/interfaces/pruefpartner";
import { api, ApiError } from "@/lib/http/apiClient";
import { useActingTenantStore } from "@/store/actingTenantStore";
import { useInspectQueueStore } from "@/store/inspectQueueStore";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";

/** Hydrates Meine Aufträge from the portal queue + resolve API. */
export function useAssignmentQueue() {
  const t = useTranslations("pruefpartner");
  const router = useRouter();
  const tenantId = useInspectQueueStore((s) => s.tenantId);
  const tenantName = useInspectQueueStore((s) => s.tenantName);
  const references = useInspectQueueStore((s) => s.references);
  const doneReferences = useInspectQueueStore((s) => s.doneReferences);
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

  useEffect(() => {
    if (!tenantId) {
      router.replace("/partner/my-sites");
      return;
    }
    setActingTenant({ tenantId, tenantName: tenantName ?? tenantId });
  }, [tenantId, tenantName, setActingTenant, router]);

  const hydrate = useCallback(async () => {
    if (!tenantId || references.length === 0) {
      setLoading(false);
      return;
    }
    setActingTenant({ tenantId, tenantName: tenantName ?? tenantId });
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        references.map((ref) =>
          api<CataloguePreviewDTO>(
            `/api/partner/inspection-runs/resolve?reference=${encodeURIComponent(ref)}`,
          ),
        ),
      );
      setRows(results);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenantName, references, setActingTenant, t]);

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
