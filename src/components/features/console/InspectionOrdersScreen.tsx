"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleRequestListDTO, ConsoleRequestRowDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/Loading";

export function InspectionOrdersScreen() {
  const t = useTranslations("console");
  const [rows, setRows] = useState<ConsoleRequestRowDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let cancelled = false;
    void api<ConsoleRequestListDTO>("/api/partner/inspection-orders")
      .then((d) => {
        if (!cancelled) setRows(d.rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : t("assignmentsLoadFailed"));
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
      [row.reference, row.tenantName, row.deviceLabel, row.managed ? "managed" : "external"]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, keyword]);

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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">{t("colTenant")}</th>
                    <th className="py-2 pr-2 font-medium">{t("colReference")}</th>
                    <th className="py-2 pr-2 font-medium">{t("colDevice")}</th>
                    <th className="py-2 pr-2 font-medium">{t("colAssignee")}</th>
                    <th className="py-2 pr-2 font-medium">{t("colState")}</th>
                    <th className="py-2 font-medium">{t("colManaged")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.reference} className="border-b border-border/70">
                      <td className="py-2 pr-2">{row.tenantName}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{row.reference}</td>
                      <td className="py-2 pr-2">{row.deviceLabel}</td>
                      <td className="py-2 pr-2">{row.assigneeName ?? "—"}</td>
                      <td className="py-2 pr-2">
                        {t(`displayState_${row.displayState}` as "displayState_erfasst")}
                      </td>
                      <td className="py-2">{row.managed ? t("managedYes") : t("managedNo")}</td>
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
