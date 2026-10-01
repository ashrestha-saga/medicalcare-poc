"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleRequestListDTO, ConsoleRequestRowDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/Loading";
import { usePermissions } from "@/lib/providers/PermissionProvider";

export function useDispositionList() {
  const t = useTranslations("console");
  const [rows, setRows] = useState<ConsoleRequestRowDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ConsoleRequestListDTO>("/api/partner/disposition");
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("dispositionLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, error, loading, refresh };
}

export function DispositionScreen() {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canAssign = checkPermission("console:disposition:assign");
  const { rows, error, loading, refresh } = useDispositionList();
  const [keyword, setKeyword] = useState("");
  const [busyRef, setBusyRef] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.reference, row.tenantName, row.deviceLabel, row.assigneeName ?? "", row.displayState]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, keyword]);

  async function patchRow(
    reference: string,
    body: { assigneeUserId?: string | null; scheduledAt?: string | null },
  ) {
    setBusyRef(reference);
    try {
      await api(`/api/partner/disposition/${encodeURIComponent(reference)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success(t("dispositionSaved"));
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("dispositionSaveFailed"));
    } finally {
      setBusyRef(null);
    }
  }

  return (
    <div className="p-work" data-testid="console-disposition">
      <main className="p-main">
        <ListPageShell title={t("dispositionTitle")} description={t("dispositionIntro")}>
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
          <div className="mb-3">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t("dispositionSearch")}
              className="max-w-sm"
            />
          </div>
          {!loading && filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dispositionEmpty")}</p>
          ) : null}
          {filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" data-testid="disposition-table">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">{t("colTenant")}</th>
                    <th className="py-2 pr-2 font-medium">{t("colReference")}</th>
                    <th className="py-2 pr-2 font-medium">{t("colDevice")}</th>
                    <th className="py-2 pr-2 font-medium">{t("colExecutor")}</th>
                    <th className="py-2 pr-2 font-medium">{t("colAssignee")}</th>
                    <th className="py-2 pr-2 font-medium">{t("colSchedule")}</th>
                    <th className="py-2 font-medium">{t("colState")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.reference} className="border-b border-border/70 align-top">
                      <td className="py-2 pr-2">
                        <b>{row.tenantName}</b>
                        <div className="text-xs text-muted-foreground">{row.tenantCode}</div>
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs">{row.reference}</td>
                      <td className="py-2 pr-2">{row.deviceLabel}</td>
                      <td className="py-2 pr-2 text-xs">{row.executorName ?? "—"}</td>
                      <td className="py-2 pr-2">
                        {canAssign ? (
                          <AssigneeCell
                            row={row}
                            busy={busyRef === row.reference}
                            onAssign={(userId) =>
                              void patchRow(row.reference, { assigneeUserId: userId })
                            }
                          />
                        ) : (
                          row.assigneeName ?? "—"
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {canAssign ? (
                          <Input
                            type="date"
                            className="h-8 w-[140px]"
                            defaultValue={row.scheduledAt ?? ""}
                            disabled={busyRef === row.reference}
                            onBlur={(e) => {
                              const next = e.target.value || null;
                              if (next !== row.scheduledAt) {
                                void patchRow(row.reference, { scheduledAt: next });
                              }
                            }}
                          />
                        ) : (
                          row.scheduledAt ?? "—"
                        )}
                      </td>
                      <td className="py-2">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                          {t(`displayState_${row.displayState}` as "displayState_erfasst")}
                        </span>
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

function AssigneeCell({
  row,
  busy,
  onAssign,
}: {
  row: ConsoleRequestRowDTO;
  busy: boolean;
  onAssign: (userId: string | null) => void;
}) {
  const [options, setOptions] = useState<{ userId: string; name: string; isExternal: boolean }[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void api<{ assignees: { userId: string; name: string; isExternal: boolean }[] }>(
      `/api/partner/disposition/assignees?tenantId=${encodeURIComponent(row.tenantId)}`,
    )
      .then((d) => {
        if (!cancelled) setOptions(d.assignees);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [row.tenantId]);

  return (
    <select
      className="h-8 max-w-[160px] rounded-md border border-border bg-transparent px-2 text-xs"
      value={row.assigneeUserId ?? ""}
      disabled={busy}
      onChange={(e) => onAssign(e.target.value || null)}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.userId} value={o.userId}>
          {o.name}
          {o.isExternal ? " *" : ""}
        </option>
      ))}
    </select>
  );
}
