"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleAuditListDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/Loading";

const SCOPE_LABEL: Record<
  string,
  "auditScopeOrg" | "auditScopeTenant" | "auditScopePlatform" | "auditScopeOther"
> = {
  managing_org: "auditScopeOrg",
  tenant: "auditScopeTenant",
  platform: "auditScopePlatform",
  other: "auditScopeOther",
};

export function ActivityScreen() {
  const t = useTranslations("console");
  const [data, setData] = useState<ConsoleAuditListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void api<ConsoleAuditListDTO>("/api/partner/audit?limit=100")
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : t("auditLoadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className="p-work" data-testid="console-activity">
      <main className="p-main">
        <ListPageShell title={t("auditTitle")} description={t("auditIntro")}>
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
          {data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">{t("auditColTime")}</th>
                    <th className="py-2 pr-2 font-medium">{t("auditColScope")}</th>
                    <th className="py-2 pr-2 font-medium">{t("auditColActor")}</th>
                    <th className="py-2 font-medium">{t("auditColAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((ev) => (
                    <tr key={ev.id} className="border-b border-border/60">
                      <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">
                        {ev.occurredAt.replace("T", " ").slice(0, 16)}
                      </td>
                      <td className="py-2 pr-2 text-xs text-primary">
                        {t(SCOPE_LABEL[ev.actingScope] ?? "auditScopeOther")}
                      </td>
                      <td className="py-2 pr-2 text-xs">{ev.actorName}</td>
                      <td className="py-2 text-xs">
                        {ev.summary}
                        <span className="block text-muted-foreground">
                          {ev.resource}/{ev.resourceId}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("auditEmpty")}</p>
              ) : null}
            </div>
          ) : null}
        </ListPageShell>
      </main>
    </div>
  );
}
