"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleDutyListDTO, ConsoleDutyRowDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useConsoleDueDatesColumns } from "@/components/hooks/console/useConsoleDueDatesColumns";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ConsoleDueDatesScreen() {
  const t = useTranslations("console");
  const tFilters = useTranslations("filters");
  const [rows, setRows] = useState<ConsoleDutyRowDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const columns = useConsoleDueDatesColumns();

  useEffect(() => {
    let cancelled = false;
    void api<ConsoleDutyListDTO>("/api/partner/due-dates")
      .then((d) => {
        if (!cancelled) setRows(d.rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : t("dueDatesLoadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.tenantName,
        row.tenantCode ?? "",
        row.inventoryNumber ?? "",
        row.deviceLabel,
        row.title ?? "",
        row.dutyKey,
        row.deadlineAnchor,
        row.confidence,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, keyword]);

  return (
    <div className="p-work" data-testid="console-due-dates">
      <main className="p-main">
        <ListPageShell title={t("dueDatesTitle")} description={t("dueDatesIntro")}>
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
            searchPlaceholder={tFilters("searchDueDates")}
          />
        </ListPageShell>
      </main>
    </div>
  );
}
