"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePartnerVisits } from "@/components/hooks/partner/visits/usePartnerVisits";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import type { ServiceVisitDTO } from "@/interfaces/console";

type Hint = {
  count: number;
  deviceIds: string[];
  show: boolean;
  reason?: string;
};

function travelLabel(count: number, t: ReturnType<typeof useTranslations<"console">>) {
  if (count <= 1) return null;
  return t("visitsTravelSaved", { n: count });
}

export function VisitsPanel({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations("console");
  const { rows, error, loading, startVisit, refresh } = usePartnerVisits();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signerByVisit, setSignerByVisit] = useState<Record<string, string>>({});
  const [hints, setHints] = useState<Record<string, Hint>>({});

  const loadHint = useCallback(async (visit: ServiceVisitDTO) => {
    if (!visit.siteId) return;
    try {
      const res = await api<{ hint: Hint }>(
        `/api/partner/visits/${encodeURIComponent(visit.id)}/dguv-hint`,
      );
      setHints((prev) => ({ ...prev, [visit.id]: res.hint }));
    } catch {
      /* soft */
    }
  }, []);

  useEffect(() => {
    for (const v of rows) {
      if (v.siteId && !hints[v.id]) void loadHint(v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per row id set
  }, [rows]);

  const attachDguv = async (visit: ServiceVisitDTO) => {
    setBusyId(visit.id);
    try {
      const hint = hints[visit.id];
      const res = await api<{ result: { reference: string | null; itemCount: number } }>(
        `/api/partner/visits/${encodeURIComponent(visit.id)}/dguv-attach`,
        {
          method: "POST",
          body: JSON.stringify({
            deviceInstanceIds: hint?.deviceIds?.length ? hint.deviceIds : undefined,
          }),
        },
      );
      toast.success(
        t("dguvMitnehmenOk", {
          n: res.result.itemCount,
          ref: res.result.reference ?? "—",
        }),
      );
      setHints((prev) => ({
        ...prev,
        [visit.id]: { count: 0, deviceIds: [], show: false },
      }));
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("dguvMitnehmenFailed"));
    } finally {
      setBusyId(null);
    }
  };

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

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{t("visitsColVisit")}</th>
              <th className="px-3 py-2">{t("visitsColDate")}</th>
              <th className="px-3 py-2">{t("visitsColFacility")}</th>
              <th className="px-3 py-2">{t("visitsColTech")}</th>
              <th className="px-3 py-2">{t("visitsColOrders")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((v) => {
              const hint = hints[v.id];
              const saved = travelLabel(v.requestCount, t);
              return (
                <tr key={v.id} className="align-top" data-testid={`visit-row-${v.id}`}>
                  <td className="px-3 py-3">
                    <p className="font-mono text-xs font-medium">{v.id.slice(0, 14)}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {v.completedAt
                        ? t("visitsStatusEnded")
                        : v.startedAt
                          ? t("visitsStarted")
                          : t("visitsStatusPlanned")}
                      {v.sequence > 1 ? ` · #${v.sequence}` : ""}
                    </p>
                    {!v.startedAt ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => void startVisit(v.id, v.tenantId)}
                      >
                        {t("visitsStart")}
                      </Button>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {v.plannedAt
                      ? new Date(v.plannedAt).toLocaleDateString("de-DE")
                      : v.startedAt
                        ? new Date(v.startedAt).toLocaleDateString("de-DE")
                        : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{v.tenantName}</p>
                    <p className="text-xs text-muted-foreground">{v.siteName ?? "—"}</p>
                  </td>
                  <td className="px-3 py-3 text-xs">{v.technicianName ?? "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(v.requestReferences ?? []).map((ref) => (
                        <Badge key={ref} variant="secondary" className="font-mono text-[10px]">
                          {ref}
                        </Badge>
                      ))}
                      {v.requestCount > (v.requestReferences?.length ?? 0) ? (
                        <span className="text-[10px] text-muted-foreground">
                          {(v.requestReferences?.length ?? 0) > 0
                            ? `+${v.requestCount - v.requestReferences.length}`
                            : t("visitsOrdersCount", { n: v.requestCount })}
                        </span>
                      ) : null}
                    </div>
                    {saved ? (
                      <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        {saved}
                      </p>
                    ) : null}

                    {hint?.show ? (
                      <div
                        className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-2 py-1.5 text-xs"
                        data-testid={`visit-dguv-mitnehmen-${v.id}`}
                      >
                        <span>{t("dguvMitnehmenHint", { n: hint.count })}</span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === v.id}
                          onClick={() => void attachDguv(v)}
                        >
                          {t("dguvMitnehmenAccept")}
                        </Button>
                      </div>
                    ) : hint && !hint.show && hint.reason === "technician_fails_dguv_gate" ? (
                      <p
                        className="mt-2 text-[11px] text-muted-foreground"
                        data-testid={`visit-dguv-gate-blocked-${v.id}`}
                      >
                        {t("dguvMitnehmenGateBlocked")}
                      </p>
                    ) : null}

                    {v.startedAt ? (
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <div className="min-w-[10rem] flex-1 space-y-1">
                          <label
                            className="text-[10px] text-muted-foreground"
                            htmlFor={`inst-signer-${v.id}`}
                          >
                            {t("institutionSigner")}
                          </label>
                          <Input
                            id={`inst-signer-${v.id}`}
                            value={signerByVisit[v.id] ?? ""}
                            onChange={(e) =>
                              setSignerByVisit((prev) => ({
                                ...prev,
                                [v.id]: e.target.value,
                              }))
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
