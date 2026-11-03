"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useDispatchColumns } from "@/components/hooks/partner/inspection-orders/useDispatchColumns";
import { useInspectionOrdersList } from "@/components/hooks/partner/inspection-orders/useInspectionOrdersList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { cn } from "@/lib/utils";
import type { DispatchPipelineFilter } from "@/schemas/console";

function InspectionOrdersBody({ embedded }: { embedded: boolean }) {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canDispatch = checkPermission("console:disposition:assign");
  const {
    filtered,
    error,
    loading,
    keyword,
    setKeyword,
    busyRef,
    pipeline,
    setPipeline,
    reason,
    focus,
    clearFocusFilters,
    counts,
    appointmentValue,
    onDraftDate,
    onAdvance,
    onAssignHandler,
    ensureAssignees,
    assigneesByTenant,
    assigneesLoading,
  } = useInspectionOrdersList();

  const focusLabel =
    reason === "befund"
      ? t("dispatchFocusAuthority")
      : focus === "unscheduled"
        ? t("dispatchFocusUnscheduled")
        : focus === "return"
          ? t("dispatchFocusReturn")
          : focus === "out_of_contract"
            ? t("dispatchFocusOutOfContract")
            : null;

  const columns = useDispatchColumns({
    canDispatch,
    busyRef,
    appointmentValue,
    onDraftDate,
    onAdvance,
    onAssignHandler,
    ensureAssignees,
    assigneesByTenant,
    assigneesLoading,
  });

  const filters: { id: DispatchPipelineFilter; label: string; count: number }[] = [
    { id: "all", label: t("dispatchFilterAll"), count: counts.all },
    {
      id: "needs_handler",
      label: t("dispatchFilterNeedsHandler"),
      count: counts.needs_handler,
    },
    {
      id: "needs_appointment",
      label: t("dispatchFilterNeedsAppointment"),
      count: counts.needs_appointment,
    },
    { id: "scheduled", label: t("dispatchFilterScheduled"), count: counts.scheduled },
    { id: "in_progress", label: t("dispatchFilterInProgress"), count: counts.in_progress },
    { id: "done", label: t("dispatchFilterDone"), count: counts.done },
  ];

  return (
    <>
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {focusLabel ? (
        <Alert className="mb-4">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {t("dispatchFocusActive", { label: focusLabel })} · {filtered.length}
            </span>
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={clearFocusFilters}>
              {t("dispatchFocusClear")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-1.5"
          role="tablist"
          aria-label={t("dispatchFilterLabel")}
        >
          {filters.map((f) => (
            <Button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={pipeline === f.id}
              variant={pipeline === f.id ? "default" : "outline"}
              size="sm"
              className={cn("h-8", pipeline === f.id && "shadow-sm")}
              onClick={() => setPipeline(f.id)}
            >
              {f.label}
              <span className="ml-1.5 tabular-nums text-xs opacity-70">{f.count}</span>
            </Button>
          ))}
        </div>
        {!embedded && checkPermission("console:disposition:view") ? (
          <Button asChild variant="secondary" size="sm" className="h-8">
            <Link href="/partner/orders?tab=execution">{t("dispatchGoPortfolio")}</Link>
          </Button>
        ) : null}
      </div>

      {!canDispatch ? (
        <Alert className="mb-4">
          <AlertDescription>{t("dispatchReadOnlyHint")}</AlertDescription>
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
        emptyMessage={t("assignmentsEmpty")}
        searchPlaceholder={t("dispositionSearch")}
        className="min-w-0"
      />

      <div className="mt-4 rounded-md border border-border border-l-[3px] border-l-primary bg-muted/30 px-4 py-3 text-sm leading-relaxed">
        <b>{t("dispatchNoteTitle")}</b> {t("dispatchNoteBody")}
      </div>
    </>
  );
}

export function InspectionOrdersScreen({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations("console");

  if (embedded) {
    return (
      <div data-testid="console-inspection-orders">
        <InspectionOrdersBody embedded />
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="console-inspection-orders">
      <main className="p-main">
        <ListPageShell
          title={t("assignmentsTitle")}
          description={t("assignmentsIntro")}
          contentClassName="max-w-none"
        >
          <InspectionOrdersBody embedded={false} />
        </ListPageShell>
      </main>
    </div>
  );
}
