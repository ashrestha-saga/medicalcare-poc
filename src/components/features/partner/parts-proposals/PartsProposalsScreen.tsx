"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/http/apiClient";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toastStore";

type Proposal = {
  id: string;
  status: string;
  orderRef: string | null;
  triggeredVia: string;
  createdAt: string;
  createdBy?: string | null;
  serviceRequest?: { reference: string } | null;
  lines: { description: string; partNo: string | null; qty: number }[];
};

type StatusFilter = "all" | "open" | "ordered" | "discarded";

function statusBadgeClass(status: string): string {
  if (status === "open") {
    return "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-200";
  }
  if (status === "ordered") {
    return "border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
  }
  if (status === "discarded") {
    return "border-transparent bg-muted text-muted-foreground";
  }
  return "border-border bg-muted text-muted-foreground";
}

/** E80 console list — Bestellvorschläge. */
export function PartsProposalsScreen() {
  const t = useTranslations("repairs.partsProposals");
  const [rows, setRows] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ proposals: Proposal[] }>("/api/partner/parts-proposals");
      setRows(res.proposals);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("error");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  async function order(id: string) {
    const orderRef = `PO-${Date.now().toString().slice(-6)}`;
    setBusyId(id);
    try {
      await api(`/api/partner/parts-proposals/${id}/order`, {
        method: "POST",
        body: JSON.stringify({ orderRef }),
      });
      toast.success(t("ordered", { ref: orderRef }));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setBusyId(null);
    }
  }

  async function discard(id: string) {
    const reason = window.prompt(t("discardPrompt"));
    if (!reason?.trim()) return;
    setBusyId(id);
    try {
      await api(`/api/partner/parts-proposals/${id}/discard`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      toast.success(t("discarded"));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setBusyId(null);
    }
  }

  const filters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: t("filterAll") },
    { id: "open", label: t("filterOpen") },
    { id: "ordered", label: t("filterOrdered") },
    { id: "discarded", label: t("filterDiscarded") },
  ];

  return (
    <div className="p-work" data-testid="parts-proposals-page">
      <main className="p-main">
        <ListPageShell title={t("title")} description={t("subtitle")}>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-1" role="tablist" aria-label={t("colStatus")}>
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={statusFilter === f.id}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  statusFilter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2.5 font-semibold">{t("colOrder")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("colParts")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("colStatus")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("colCreated")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const orderRef = r.serviceRequest?.reference;
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border/70 align-top last:border-0"
                        data-testid={`parts-proposal-${r.id}`}
                      >
                        <td className="px-3 py-3">
                          {orderRef ? (
                            <Link
                              href={`/partner/orders/${encodeURIComponent(orderRef)}`}
                              className="font-medium text-primary hover:underline"
                              data-testid={`parts-proposal-order-${orderRef}`}
                            >
                              {orderRef}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {r.id.slice(0, 12)}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <ul className="space-y-1">
                            {r.lines.map((l, i) => (
                              <li key={`${r.id}-${i}`}>
                                {l.description}
                                {l.partNo ? (
                                  <span className="text-muted-foreground"> ({l.partNo})</span>
                                ) : null}
                                <span className="text-muted-foreground"> ×{l.qty}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={statusBadgeClass(r.status)}>
                              {r.status === "open" ||
                              r.status === "ordered" ||
                              r.status === "discarded"
                                ? t(`status_${r.status}`)
                                : r.status}
                            </Badge>
                            {r.orderRef ? (
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {r.orderRef}
                              </span>
                            ) : null}
                            {r.triggeredVia === "devicecare" ? (
                              <span className="text-[11px] text-muted-foreground">
                                {t("viaDeviceCare")}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          <div>
                            {new Date(r.createdAt).toLocaleString(undefined, {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          {r.createdBy ? (
                            <div className="mt-0.5 text-[11px]">{r.createdBy}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          {r.status === "open" ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                type="button"
                                className="h-8"
                                disabled={busyId === r.id}
                                onClick={() => void order(r.id)}
                              >
                                {t("order")}
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                className="h-8"
                                disabled={busyId === r.id}
                                onClick={() => void discard(r.id)}
                              >
                                {t("discard")}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ListPageShell>
      </main>
    </div>
  );
}
