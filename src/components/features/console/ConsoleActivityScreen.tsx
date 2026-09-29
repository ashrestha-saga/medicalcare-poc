"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleAuditListDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/Loading";

export function ConsoleActivityScreen() {
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
            <div className="space-y-2 font-mono text-xs">
              {data.events.map((ev) => (
                <div key={ev.id} className="border-b border-border/60 py-2">
                  <span className="text-muted-foreground">{ev.occurredAt.replace("T", " ").slice(0, 16)}</span>
                  {" · "}
                  <span className="text-primary">
                    {ev.capacity === "managing_org"
                      ? t("auditCapacityOrg")
                      : ev.capacity === "tenant"
                        ? t("auditCapacityTenant")
                        : t("auditCapacityOther")}
                  </span>
                  {" · "}
                  <span>{ev.actorName}</span>
                  {" — "}
                  <span>{ev.summary}</span>
                </div>
              ))}
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
