"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCustomerList } from "@/components/hooks/partner/customers/useCustomerList";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Loading";
import { usePermissions } from "@/lib/providers/PermissionProvider";

const SCOPE_KEYS: Record<
  string,
  "scopeInventory" | "scopeDueDates" | "scopeInspection" | "scopeReprocessing" | "scopeTraining"
> = {
  inventory: "scopeInventory",
  "due-dates": "scopeDueDates",
  inspection: "scopeInspection",
  reprocessing: "scopeReprocessing",
  training: "scopeTraining",
};

export function CustomersScreen() {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const { data, error, loading } = useCustomerList();
  const { checkPermission } = usePermissions();
  const canCreate = checkPermission("console:customers:create") && Boolean(data?.canCreate);

  return (
    <div className="p-work" data-testid="console-customers-page">
      <main className="p-main">
        <ListPageShell
          title={t("customersTitle")}
          description={t("customersIntro")}
          headerExtra={
            canCreate ? (
              <Button asChild>
                <Link href="/partner/customers/new" data-testid="console-create-clinic">
                  {t("createClinic")}
                </Link>
              </Button>
            ) : null
          }
        >
          {loading ? (
            <div className="p-wait">
              <Spinner />
            </div>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!loading && data?.kpis ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" data-testid="console-kpis">
              <Kpi label={t("kpiCustomers")} value={data.kpis.customersTotal} hint={t("kpiCustomersLive", { count: data.kpis.customersLive })} />
              <Kpi label={t("kpiDevices")} value={data.kpis.devicesManaged} hint={t("kpiDevicesHint")} />
              <Kpi
                label={t("kpiOverdue")}
                value={data.kpis.overdueDuties}
                hint={t("kpiOverdueHint")}
                warn={data.kpis.overdueDuties > 0}
              />
              <Kpi
                label={t("kpiClarifications")}
                value={data.kpis.openClarifications}
                hint={t("kpiClarificationsHint")}
                warn={data.kpis.openClarifications > 0}
              />
              <Kpi
                label={t("kpiMpsb")}
                value={data.kpis.openMpsb}
                hint={t("kpiMpsbHint")}
                warn={data.kpis.openMpsb > 0}
              />
              <Kpi label={t("kpiLive")} value={data.kpis.customersLive} hint={t("kpiLiveHint")} />
            </div>
          ) : null}
          {!loading && data && data.clinics.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="console-customers-empty">
              {t("customersEmpty")}
            </p>
          ) : null}
          {!loading && data && data.clinics.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" data-testid="console-customers-table">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{t("colInstitution")}</th>
                    <th className="py-2 pr-3 font-medium">{t("colSites")}</th>
                    <th className="py-2 pr-3 font-medium">{t("colDevices")}</th>
                    <th className="py-2 pr-3 font-medium">{t("colContract")}</th>
                    <th className="py-2 pr-3 font-medium">{t("colScope")}</th>
                    <th className="py-2 font-medium">{t("colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clinics.map((clinic) => (
                    <tr key={clinic.contractId} className="border-b border-border/70">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/partner/customers/${clinic.contractId}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          data-testid={`clinic-link-${clinic.contractId}`}
                        >
                          {clinic.tenantName}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {[clinic.city, clinic.tenantCode].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">{clinic.siteCount}</td>
                      <td className="py-2.5 pr-3">{clinic.deviceCount}</td>
                      <td className="py-2.5 pr-3 text-xs">
                        {clinic.validFrom}
                        {clinic.validTo ? ` — ${clinic.validTo}` : ` — ${t("openEnded")}`}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {clinic.scope.map((s) => (
                            <span key={s} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                              {t(SCOPE_KEYS[s] ?? "scopeInventory")}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <StatusChip live={clinic.live} suspended={Boolean(clinic.suspendedAt)} terminated={Boolean(clinic.terminatedAt)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">{t("customersNote")}</p>
          {data && !canCreate ? (
            <p className="mt-2 text-xs text-muted-foreground">{tCommon("contactAdmin")}</p>
          ) : null}
        </ListPageShell>
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: number;
  hint: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${warn ? "text-destructive" : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function StatusChip({
  live,
  suspended,
  terminated,
}: {
  live: boolean;
  suspended: boolean;
  terminated: boolean;
}) {
  const t = useTranslations("console");
  if (terminated) {
    return <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{t("statusTerminated")}</span>;
  }
  if (suspended) {
    return <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200">{t("statusSuspended")}</span>;
  }
  if (live) {
    return <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-200">{t("active")}</span>;
  }
  return <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t("ended")}</span>;
}
