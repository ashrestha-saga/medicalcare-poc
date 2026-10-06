"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleRequestListDTO, ConsoleRequestRowDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useDispositionColumns } from "@/components/hooks/partner/disposition/useDispositionColumns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePermissions } from "@/lib/providers/PermissionProvider";

export function useDispositionList() {
  const t = useTranslations("console");
  const [rows, setRows] = useState<ConsoleRequestRowDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ConsoleRequestListDTO>("/api/partner/disposition");
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("dispositionLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, error, loading, refresh };
}

export function DispositionScreen() {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canAdvance = checkPermission("console:disposition:assign");
  const { rows, error, loading, refresh } = useDispositionList();
  const [keyword, setKeyword] = useState("");
  const [busyRef, setBusyRef] = useState<string | null>(null);
  /** Draft appointment dates — persisted only when → is clicked. */
  const [draftDates, setDraftDates] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.reference,
        row.tenantName,
        row.deviceLabel,
        row.deviceDetail ?? "",
        row.serviceType,
        row.executorCode ?? "",
        row.assigneeName ?? "",
        row.displayState,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, keyword]);

  const appointmentValue = useCallback(
    (row: ConsoleRequestRowDTO) => draftDates[row.reference] ?? row.scheduledAt ?? "",
    [draftDates],
  );

  const onDraftDate = useCallback((reference: string, value: string) => {
    setDraftDates((prev) => ({ ...prev, [reference]: value }));
  }, []);

  const onAdvance = useCallback(
    async (row: ConsoleRequestRowDTO) => {
      setBusyRef(row.reference);
      try {
        const scheduledAt = appointmentValue(row) || null;
        await api(`/api/partner/disposition/${encodeURIComponent(row.reference)}/advance`, {
          method: "POST",
          body: JSON.stringify({ scheduledAt }),
        });
        setDraftDates((prev) => {
          const next = { ...prev };
          delete next[row.reference];
          return next;
        });
        toast.success(t("dispositionAdvanced"));
        await refresh();
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : t("dispositionAdvanceFailed"));
      } finally {
        setBusyRef(null);
      }
    },
    [appointmentValue, refresh, t],
  );

  const columns = useDispositionColumns({
    canAdvance,
    busyRef,
    appointmentValue,
    onDraftDate,
    onAdvance,
  });

  return (
    <div className="p-work" data-testid="console-disposition">
      <main className="p-main">
        <ListPageShell
          title={t("dispositionTitle")}
          description={t("dispositionIntro")}
          contentClassName="max-w-none"
        >
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DataTable
            data={filtered}
            columns={columns}
            search
            visibility
            displayPagination
            keyword={keyword}
            setKeyword={setKeyword}
            removeKeyword={() => setKeyword("")}
            isLoading={loading}
            totalItems={filtered.length}
            getRowId={(row) => row.reference}
            emptyMessage={t("dispositionEmpty")}
            searchPlaceholder={t("dispositionSearch")}
            className="min-w-0"
          />

          <div className="mt-4 space-y-3">
            <div className="rounded-md border border-border border-l-[3px] border-l-primary bg-card px-4 py-3 text-sm leading-relaxed">
              <b>{t("dispositionNoteLifecycleTitle")}</b> {t("dispositionNoteLifecycleBody")}
            </div>
            <div className="rounded-md border border-border border-l-[3px] border-l-primary bg-card px-4 py-3 text-sm leading-relaxed">
              <b>{t("dispositionNoteRolesTitle")}</b> {t("dispositionNoteRolesBody")}
            </div>
          </div>
        </ListPageShell>
      </main>
    </div>
  );
}
