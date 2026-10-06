"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ConsoleDutyListDTO, ConsoleDutyRowDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useDueDatesColumns } from "@/components/hooks/partner/due-dates/useDueDatesColumns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function useDueDates() {
  const t = useTranslations("console");
  const [rows, setRows] = useState<ConsoleDutyRowDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [overdueOnly, setOverdueOnly] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = overdueOnly ? "?overdue=1" : "";
      const data = await api<ConsoleDutyListDTO>(`/api/partner/due-dates${q}`);
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("dueDatesLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [overdueOnly, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, error, loading, overdueOnly, setOverdueOnly, refresh };
}

export function DueDatesScreen() {
  const t = useTranslations("console");
  const tFilters = useTranslations("filters");
  const { rows, error, loading, overdueOnly, setOverdueOnly } = useDueDates();
  const [keyword, setKeyword] = useState("");
  const columns = useDueDatesColumns();

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.tenantName, row.inventoryNumber ?? "", row.deviceLabel, row.dutyKey, row.title ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, keyword]);

  return (
    <div className="p-work" data-testid="console-due-dates">
      <main className="p-main">
        <ListPageShell
          title={t("dueDatesTitle")}
          description={t("dueDatesIntro")}
          headerExtra={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={overdueOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setOverdueOnly((v) => !v)}
              >
                {t("dueDatesOverdueOnly")}
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/partner/disposition">{t("dueDatesToDisposition")}</Link>
              </Button>
            </div>
          }
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
            getRowId={(row) => row.dutyId}
            emptyMessage={t("dueDatesEmpty")}
            searchPlaceholder={tFilters("searchRequests")}
          />
        </ListPageShell>
      </main>
    </div>
  );
}
