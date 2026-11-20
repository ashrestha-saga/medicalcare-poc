"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useMySitesColumns } from "@/components/hooks/partner/my-sites/useMySitesColumns";
import {
  useMySitesList,
  type MySitesDistanceFilter,
  type MySitesDueFilter,
} from "@/components/hooks/partner/my-sites/useMySitesList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/Modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function MySitesBody() {
  const t = useTranslations("console");
  const {
    data,
    error,
    loading,
    starting,
    pickOpen,
    institutionsWithWork,
    distance,
    setDistance,
    due,
    setDue,
    keyword,
    setKeyword,
    filtered,
    summaryCount,
    openTenant,
    startInspection,
    handOffInstitution,
    closePickInstitution,
  } = useMySitesList();
  const columns = useMySitesColumns(openTenant);

  return (
    <div className="p-work" data-testid="console-my-sites">
      <main className="p-main">
        <ListPageShell
          title={t("mySitesTitle")}
          description={t("mySitesIntro")}
          headerExtra={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                data-testid="my-sites-start-inspection"
                disabled={loading || starting || summaryCount === 0}
                onClick={() => startInspection()}
              >
                {starting ? t("mySitesStarting") : t("mySitesStartInspection")}
              </Button>
            </div>
          }
        >
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="mb-4 grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("mySitesFilterDistance", {
                  place: data?.depotLabel ?? "—",
                })}
              </Label>
              <Select
                value={distance}
                onValueChange={(v) => setDistance(v as MySitesDistanceFilter)}
              >
                <SelectTrigger data-testid="my-sites-distance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">{t("mySitesDistanceAll")}</SelectItem>
                  <SelectItem value="nah">{t("mySitesDistance_nah")}</SelectItem>
                  <SelectItem value="mittel">{t("mySitesDistance_mittel")}</SelectItem>
                  <SelectItem value="fern">{t("mySitesDistance_fern")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("mySitesFilterDue")}
              </Label>
              <Select value={due} onValueChange={(v) => setDue(v as MySitesDueFilter)}>
                <SelectTrigger data-testid="my-sites-due">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">{t("mySitesDueAll")}</SelectItem>
                  <SelectItem value="ueber">{t("mySitesDueOverdue")}</SelectItem>
                  <SelectItem value="30">{t("mySitesDue30")}</SelectItem>
                  <SelectItem value="90">{t("mySitesDue90")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            getRowId={(row) => row.tenantId}
            emptyMessage={t("mySitesEmpty")}
            searchPlaceholder={t("mySitesSearchPlaceholder")}
          />

          {!loading ? (
            <p className="mt-4 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {t("mySitesSummary", {
                  inspections: summaryCount,
                  institutions: filtered.length,
                })}
              </span>{" "}
              {t("mySitesSummaryNote")}
            </p>
          ) : null}
        </ListPageShell>
      </main>

      <Modal
        open={pickOpen}
        title={t("mySitesPickInstitutionTitle")}
        onClose={closePickInstitution}
        footer={
          <Button
            type="button"
            variant="outline"
            disabled={starting}
            onClick={closePickInstitution}
          >
            {t("mySitesPickInstitutionCancel")}
          </Button>
        }
      >
        <p className="mb-3 text-muted-foreground">{t("mySitesPickInstitutionHint")}</p>
        <ul className="divide-y divide-border rounded-md border border-border" data-testid="my-sites-pick-list">
          {institutionsWithWork.map((row) => (
            <li key={row.tenantId}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left hover:bg-muted/50 disabled:opacity-60"
                disabled={starting}
                data-testid={`my-sites-pick-${row.tenantId}`}
                onClick={() => void handOffInstitution(row)}
              >
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{row.tenantName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[row.tenantCode, row.location].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {t("mySitesPickInstitutionCount", { count: row.inspectionCount })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

export function MySitesScreen() {
  return (
    <Suspense fallback={<div className="p-work p-4 text-sm text-muted-foreground">…</div>}>
      <MySitesBody />
    </Suspense>
  );
}
