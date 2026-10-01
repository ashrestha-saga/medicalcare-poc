"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MySitesInstitutionDTO, MySitesListDTO } from "@/interfaces/console";
import { aggregateMySitesInstitutions } from "@/services/console/mySitesAggregate";
import { api, ApiError } from "@/lib/http/apiClient";
import { useSessionStore } from "@/store/sessionStore";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useMySitesColumns } from "@/components/hooks/console/useMySitesColumns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DueFilter = "alle" | "ueber" | "30" | "90";
type DistanceFilter = "alle" | "nah" | "mittel" | "fern";

export function MySitesScreen() {
  const t = useTranslations("console");
  const router = useRouter();
  const sessionUser = useSessionStore((s) => s.user);
  const isAdmin = sessionUser?.appRole === "admin";

  const [data, setData] = useState<MySitesListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [responsibility, setResponsibility] = useState<string>(isAdmin ? "all" : "self");
  const [distance, setDistance] = useState<DistanceFilter>("alle");
  const [due, setDue] = useState<DueFilter>("alle");
  const [keyword, setKeyword] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<MySitesListDTO>("/api/partner/my-sites"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("mySitesLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openTenant = useCallback(
    (row: MySitesInstitutionDTO) => {
      router.push(`/partner/my-sites/${encodeURIComponent(row.tenantId)}`);
    },
    [router],
  );

  const columns = useMySitesColumns(openTenant);

  const institutions = useMemo(() => {
    if (!data || !sessionUser) return [];
    return aggregateMySitesInstitutions(
      data.tenants,
      data.staffAssignments,
      data.inspections,
      responsibility,
      sessionUser.id,
    );
  }, [data, responsibility, sessionUser]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inDays = (iso: string | null, max: number) => {
      if (!iso) return false;
      const d = new Date(`${iso}T00:00:00`);
      const diff = (d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
      return diff >= 0 && diff <= max;
    };
    return institutions.filter((row) => {
      if (distance !== "alle" && row.distanceBand !== distance) return false;
      if (due === "ueber" && row.overdueCount === 0) return false;
      if (due === "30" && !inDays(row.nextDue, 30)) return false;
      if (due === "90" && !inDays(row.nextDue, 90)) return false;
      const q = keyword.trim().toLowerCase();
      if (!q) return true;
      const hay = [
        row.tenantName,
        row.tenantCode ?? "",
        row.location ?? "",
        ...row.assignees.map((a) => a.name),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [institutions, distance, due, keyword]);

  const summaryCount = filtered.reduce((n, r) => n + r.inspectionCount, 0);

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
              <Select
                value={responsibility}
                onValueChange={setResponsibility}
                disabled={!isAdmin}
              >
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
                onValueChange={(v) => setDistance(v as DistanceFilter)}
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
              <Select value={due} onValueChange={(v) => setDue(v as DueFilter)}>
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
