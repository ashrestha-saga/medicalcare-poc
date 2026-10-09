"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SitePortalDTO } from "@/interfaces/console";
import { matchesDevice } from "@/lib/barcode/matchDevice";
import { parseIdentifier } from "@/lib/gs1";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useActingTenantStore } from "@/store/actingTenantStore";
import { useInspectQueueStore } from "@/store/inspectQueueStore";
import { useSessionStore } from "@/store/sessionStore";
import { toast } from "@/store/toastStore";

/** Partner my-sites portal — assignments, scan filter, hand-off to /inspect. */
export function useSiteAssignments(tenantId: string) {
  const t = useTranslations("console");
  const router = useRouter();
  const { checkPermission } = usePermissions();
  const canAssign = checkPermission("console:disposition:assign");
  const isAdmin = useSessionStore((s) => s.user?.appRole === "admin");

  const [data, setData] = useState<SitePortalDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scan, setScan] = useState("");
  const [scanActive, setScanActive] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyRef, setBusyRef] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<SitePortalDTO>(
        `/api/partner/my-sites/${encodeURIComponent(tenantId)}`,
      );
      setData(res);
      setSelected((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          const row = res.assignments.find((a) => a.reference === id);
          if (row?.isMine && row.displayState !== "abgeschlossen" && row.displayState !== "abgelehnt") {
            next.add(id);
          }
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("sitePortalLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(() => {
    const rows = data?.assignments ?? [];
    const q = scanActive.trim();
    if (!q) return rows;
    const identifier = parseIdentifier(q);
    return rows.filter((row) => {
      if (!row.isMine) return false;
      if (
        matchesDevice(identifier, {
          inventoryNumber: row.inventoryNumber,
          serialNumber: row.serialNumber,
        })
      ) {
        return true;
      }
      const hay = [row.reference, row.deviceLabel].join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [data?.assignments, scanActive]);

  const mineVisible = visible.filter((r) => r.isMine);
  const selectableMine = mineVisible.filter(
    (r) => r.displayState !== "abgeschlossen" && r.displayState !== "abgelehnt",
  );

  const toggle = useCallback(
    (reference: string, mine: boolean, completed: boolean) => {
      if (!mine || completed) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(reference)) next.delete(reference);
        else next.add(reference);
        return next;
      });
    },
    [],
  );

  const selectAllMine = useCallback(() => {
    setSelected(new Set(selectableMine.map((r) => r.reference)));
  }, [selectableMine]);

  const applyScan = useCallback((raw?: string) => {
    const next = (raw ?? scan).trim();
    setScan(next);
    setScanActive(next);
  }, [scan]);

  const clearScan = useCallback(() => {
    setScan("");
    setScanActive("");
  }, []);

  const onSelectInspections = useCallback(() => {
    const allowed = new Set(selectableMine.map((r) => r.reference));
    const refs = [...selected].filter((ref) => allowed.has(ref));
    if (refs.length === 0) return;
    const tenantName = data?.tenantName ?? null;
    useInspectQueueStore.getState().setQueue({
      tenantId,
      tenantName,
      references: refs,
    });
    useActingTenantStore.getState().setActingTenant({
      tenantId,
      tenantName: tenantName ?? tenantId,
      tenantCode: data?.tenantCode ?? null,
      contractId: data?.contractId ?? null,
    });
    router.push("/inspect");
  }, [selected, selectableMine, data, tenantId, router]);

  const patchAssignment = useCallback(
    async (reference: string, body: { assigneeUserId?: string | null }) => {
      setBusyRef(reference);
      try {
        await api(
          `/api/partner/my-sites/${encodeURIComponent(tenantId)}/assignments/${encodeURIComponent(reference)}`,
          { method: "PATCH", body: JSON.stringify(body) },
        );
        toast.success(t("dispositionSaved"));
        await refresh();
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : t("dispositionSaveFailed"));
      } finally {
        setBusyRef(null);
      }
    },
    [tenantId, t, refresh],
  );

  return {
    data,
    error,
    loading,
    canAssign,
    isAdmin,
    scan,
    setScan,
    scanActive,
    applyScan,
    clearScan,
    selected,
    busyRef,
    visible,
    mineVisible,
    selectableMine,
    toggle,
    selectAllMine,
    onSelectInspections,
    patchAssignment,
    refresh,
  };
}
