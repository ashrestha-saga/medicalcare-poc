"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useDueDatesColumns } from "@/components/hooks/partner/due-dates/useDueDatesColumns";
import { useDueDatesList } from "@/components/hooks/partner/due-dates/useDueDatesList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DueDatesScreen() {
  const t = useTranslations("console");
  const tFilters = useTranslations("filters");
  const {
    filtered,
    error,
    loading,
    overdueOnly,
    setOverdueOnly,
    keyword,
    setKeyword,
  } = useDueDatesList();
  const columns = useDueDatesColumns();

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
