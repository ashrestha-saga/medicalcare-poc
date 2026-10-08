"use client";

import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useDispositionColumns } from "@/components/hooks/partner/disposition/useDispositionColumns";
import { useDispositionList } from "@/components/hooks/partner/disposition/useDispositionList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePermissions } from "@/lib/providers/PermissionProvider";

export function DispositionScreen() {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canAdvance = checkPermission("console:disposition:assign");
  const {
    filtered,
    error,
    loading,
    keyword,
    setKeyword,
    busyRef,
    appointmentValue,
    onDraftDate,
    onAdvance,
  } = useDispositionList();

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
