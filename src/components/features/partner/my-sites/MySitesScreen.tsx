"use client";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function MySitesScreen() {
  const t = useTranslations("console");
  const {
    data,
    error,
    loading,
    isAdmin,
    responsibility,
    setResponsibility,
    distance,
    setDistance,
    due,
    setDue,
    keyword,
    setKeyword,
    filtered,
    summaryCount,
    openTenant,
  } = useMySitesList();
  const columns = useMySitesColumns(openTenant);

  return (
    <div className="p-work" data-testid="console-my-sites">
      <main className="p-main">
        <ListPageShell title={t("mySitesTitle")} description={t("mySitesIntro")}>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="mb-4 grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("mySitesFilterResponsibility")}
              </Label>
              <Select value={responsibility} onValueChange={setResponsibility} disabled={!isAdmin}>
                <SelectTrigger data-testid="my-sites-responsibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">{t("mySitesResponsibilitySelf")}</SelectItem>
                  {isAdmin ? (
                    <SelectItem value="all">{t("mySitesResponsibilityAll")}</SelectItem>
                  ) : null}
                  {isAdmin
                    ? (data?.colleagues ?? []).map((c) => (
                        <SelectItem key={c.userId} value={c.userId}>
                          {c.name}
                        </SelectItem>
                      ))
                    : null}
                </SelectContent>
              </Select>
            </div>
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
    </div>
  );
}
