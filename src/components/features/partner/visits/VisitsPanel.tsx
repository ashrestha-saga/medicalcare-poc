"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePartnerVisits } from "@/components/hooks/partner/visits/usePartnerVisits";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import type { ServiceVisitDTO } from "@/interfaces/console";

export function VisitsPanel({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations("console");
  const { rows, error, loading, startVisit, refresh } = usePartnerVisits();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signerByVisit, setSignerByVisit] = useState<Record<string, string>>({});

  const signInstitution = async (visit: ServiceVisitDTO) => {
    const name = (signerByVisit[visit.id] ?? "").trim();
    if (!name) {
      toast.error(t("institutionSignerRequired"));
      return;
    }
    setBusyId(visit.id);
    try {
      await api(`/api/partner/visits/${encodeURIComponent(visit.id)}/institution-signature`, {
        method: "POST",
        body: JSON.stringify({ signerName: name }),
      });
      toast.success(t("institutionSigned"));
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("institutionSignFailed"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className={embedded ? undefined : "px-4 pb-6 pt-4 sm:px-[18px]"}
      data-testid="console-visits"
    >
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">…</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("visitsEmpty")}</p>
      ) : null}
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {rows.map((v) => (
          <li key={v.id} className="flex flex-col gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{v.tenantName}</p>
                <p className="text-xs text-muted-foreground">
                  {v.siteName ?? "—"} · {v.requestCount} {t("visitsOrders")}
                  {v.plannedAt ? ` · ${new Date(v.plannedAt).toLocaleString("de-DE")}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {v.startedAt ? (
                  <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {t("visitsStarted")}
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void startVisit(v.id, v.tenantId)}
                  >
                    {t("visitsStart")}
                  </Button>
                )}
              </div>
            </div>

            {v.startedAt ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[12rem] flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor={`inst-signer-${v.id}`}>
                    {t("institutionSigner")}
                  </label>
                  <Input
                    id={`inst-signer-${v.id}`}
                    value={signerByVisit[v.id] ?? ""}
                    onChange={(e) =>
                      setSignerByVisit((prev) => ({ ...prev, [v.id]: e.target.value }))
                    }
                    placeholder={t("institutionSignerPlaceholder")}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === v.id}
                  onClick={() => void signInstitution(v)}
                  data-testid={`visit-institution-sign-${v.id}`}
                >
                  {t("institutionSign")}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
