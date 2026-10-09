"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { TakeOverDialog } from "@/components/features/partner/disposition/TakeOverDialog";
import { useDispositionColumns } from "@/components/hooks/partner/disposition/useDispositionColumns";
import { useDispositionList } from "@/components/hooks/partner/disposition/useDispositionList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { cn } from "@/lib/utils";
import type { PortfolioContractorFilter } from "@/schemas/console";

export function DispositionScreen() {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canManage = checkPermission("console:disposition:assign");
  const {
    filtered,
    error,
    loading,
    keyword,
    setKeyword,
    busyRef,
    contractorFilter,
    setContractorFilter,
    counts,
    pendingTakeOver,
    askTakeOver,
    cancelTakeOver,
    confirmTakeOver,
  } = useDispositionList();

  const columns = useDispositionColumns({
    canManage,
    busyRef,
    onAskTakeOver: askTakeOver,
  });

  const filters: { id: PortfolioContractorFilter; label: string; count: number }[] = [
    { id: "all", label: t("portfolioFilterAll"), count: counts.all },
    { id: "ours", label: t("portfolioFilterOurs"), count: counts.ours },
    { id: "others", label: t("portfolioFilterOthers"), count: counts.others },
  ];

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

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex flex-wrap gap-1.5"
              role="tablist"
              aria-label={t("portfolioFilterLabel")}
            >
              {filters.map((f) => (
                <Button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={contractorFilter === f.id}
                  variant={contractorFilter === f.id ? "default" : "outline"}
                  size="sm"
                  className={cn("h-8", contractorFilter === f.id && "shadow-sm")}
                  onClick={() => setContractorFilter(f.id)}
                >
                  {f.label}
                  <span className="ml-1.5 tabular-nums text-xs opacity-70">{f.count}</span>
                </Button>
              ))}
            </div>
            {checkPermission("console:assignments:view") ? (
              <Button asChild variant="secondary" size="sm" className="h-8">
                <Link href="/partner/inspection-orders">{t("portfolioGoDispatch")}</Link>
              </Button>
            ) : null}
          </div>

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
              <b>{t("dispositionNoteRolesTitle")}</b> {t("dispositionNoteRolesBody")}
            </div>
            <div className="rounded-md border border-border border-l-[3px] border-l-primary bg-card px-4 py-3 text-sm leading-relaxed">
              <b>{t("dispositionNoteLifecycleTitle")}</b> {t("dispositionNoteLifecycleBody")}
            </div>
          </div>
        </ListPageShell>

        <TakeOverDialog
          row={pendingTakeOver}
          busy={Boolean(pendingTakeOver && busyRef === pendingTakeOver.reference)}
          onClose={cancelTakeOver}
          onConfirm={() => void confirmTakeOver()}
        />
      </main>
    </div>
  );
}
