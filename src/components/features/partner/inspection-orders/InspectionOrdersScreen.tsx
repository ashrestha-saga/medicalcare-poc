"use client";

import { useTranslations } from "next-intl";
import { useInspectionOrdersList } from "@/components/hooks/partner/inspection-orders/useInspectionOrdersList";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/Loading";

export function InspectionOrdersScreen() {
  const t = useTranslations("console");
  const { filtered, error, loading, keyword, setKeyword } = useInspectionOrdersList();

  return (
    <div className="p-work" data-testid="console-inspection-orders">
      <main className="p-main">
        <ListPageShell title={t("assignmentsTitle")} description={t("assignmentsIntro")}>
          {loading ? (
            <div className="p-wait">
              <Spinner />
            </div>
          ) : null}
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Input
            className="mb-3 max-w-sm"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t("dispositionSearch")}
          />
          {!loading && filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("assignmentsEmpty")}</p>
          ) : null}
          {filtered.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-3 py-2.5 font-semibold">{t("colAssignment")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("colInstitution")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("colDevice")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("colService")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("colHandler")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("colState")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("colManaged")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.reference} className="border-b border-border/70 align-top last:border-0">
                      <td className="px-3 py-3 font-mono text-xs">{row.reference}</td>
                      <td className="px-3 py-3">
                        <b className="font-semibold">{row.tenantName}</b>
                        {!row.managed ? (
                          <span className="mt-1 block w-fit rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {t("managedChipNo")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div>{row.deviceLabel}</div>
                        {row.deviceDetail ? (
                          <div className="text-xs text-muted-foreground">{row.deviceDetail}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs lowercase">{row.serviceType}</td>
                      <td className="px-3 py-3">{row.assigneeName ?? "—"}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs">
                          {t(`displayState_${row.displayState}` as "displayState_erfasst")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {row.managed ? t("managedYes") : t("managedNo")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </ListPageShell>
      </main>
    </div>
  );
}
