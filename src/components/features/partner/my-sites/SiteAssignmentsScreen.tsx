"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { SiteAssignmentRowDTO, SitePortalDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useSessionStore } from "@/store/sessionStore";
import { toast } from "@/store/toastStore";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";

export function SiteAssignmentsScreen({ tenantId }: { tenantId: string }) {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canAssign = checkPermission("console:disposition:assign");
  const isAdmin = useSessionStore((s) => s.user?.appRole === "admin");

  const [data, setData] = useState<SitePortalDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scan, setScan] = useState("");
  const [scanActive, setScanActive] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyRef, setBusyRef] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<SitePortalDTO>(
        `/api/partner/my-sites/${encodeURIComponent(tenantId)}`,
      );
      setData(res);
      setSelected((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (res.assignments.some((a) => a.reference === id && a.isMine)) next.add(id);
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("sitePortalLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(() => {
    const rows = data?.assignments ?? [];
    const q = scanActive.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      if (!row.isMine) return false;
      const hay = [row.inventoryNumber ?? "", row.serialNumber ?? "", row.reference, row.deviceLabel]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data?.assignments, scanActive]);

  const mineVisible = visible.filter((r) => r.isMine);

  function toggle(reference: string, mine: boolean) {
    if (!mine) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(reference)) next.delete(reference);
      else next.add(reference);
      return next;
    });
  }

  function selectAllMine() {
    setSelected(new Set(mineVisible.map((r) => r.reference)));
  }

  function onSelectInspections() {
    // Scoping / hand-off to service-partner portal comes later.
    toast.info(t("sitePortalSelectLater"));
  }

  async function patchAssignment(reference: string, body: { assigneeUserId?: string | null }) {
    setBusyRef(reference);
    try {
      await api(
        `/api/partner/my-sites/${encodeURIComponent(tenantId)}/assignments/${encodeURIComponent(reference)}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      toast.success(t("dispositionSaved"));
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("dispositionSaveFailed"));
    } finally {
      setBusyRef(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="p-work" data-testid="console-site-portal">
        <main className="p-main">
          <div className="p-wait">
            <Spinner />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="console-site-portal">
      <main className="p-main">
        <div className="space-y-6 px-4 pb-6 pt-4 sm:px-[18px]">
        <div>
          <Link
            href="/partner/my-sites"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t("sitePortalBack")}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {data?.tenantName ?? "—"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[data?.location, t("sitePortalSubtitle", {
              mine: data?.mineCount ?? 0,
              total: data?.totalCount ?? 0,
            })]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="rounded-lg border border-border bg-card p-4">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("sitePortalVerifyTitle")}
          </Label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setScanActive(scan);
                }
              }}
              placeholder={t("sitePortalVerifyPlaceholder")}
              className="flex-1"
              data-testid="site-portal-scan"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setScanActive(scan)}
            >
              {t("sitePortalScan")}
            </Button>
            {scanActive ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setScan("");
                  setScanActive("");
                }}
              >
                {t("sitePortalClearScan")}
              </Button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("sitePortalVerifyHint")}</p>
        </section>

        {visible.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">{t("sitePortalEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 font-semibold">{t("sitePortalColAssignment")}</th>
                  <th className="px-3 py-2 font-semibold">{t("sitePortalColDevice")}</th>
                  <th className="px-3 py-2 font-semibold">{t("sitePortalColType")}</th>
                  <th className="px-3 py-2 font-semibold">{t("sitePortalColLocation")}</th>
                  <th className="px-3 py-2 font-semibold">{t("sitePortalColDue")}</th>
                  <th className="px-3 py-2 font-semibold">{t("sitePortalColState")}</th>
                  <th className="px-3 py-2 font-semibold">{t("sitePortalColAssignee")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <AssignmentRow
                    key={row.reference}
                    row={row}
                    checked={selected.has(row.reference)}
                    onToggle={() => toggle(row.reference, row.isMine)}
                    canEditAssignee={
                      canAssign && (row.isMine || (isAdmin && !row.assigneeUserId))
                    }
                    busy={busyRef === row.reference}
                    assignees={data?.assignees ?? []}
                    onAssign={(userId) =>
                      void patchAssignment(row.reference, { assigneeUserId: userId })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={selectAllMine} disabled={mineVisible.length === 0}>
            {t("sitePortalSelectAllMine")}
          </Button>
          <Button
            type="button"
            onClick={onSelectInspections}
            disabled={selected.size === 0}
          >
            {t("sitePortalSelectInspections")}
          </Button>
        </div>
        </div>
      </main>
    </div>
  );
}

function AssignmentRow({
  row,
  checked,
  onToggle,
  canEditAssignee,
  busy,
  assignees,
  onAssign,
}: {
  row: SiteAssignmentRowDTO;
  checked: boolean;
  onToggle: () => void;
  canEditAssignee: boolean;
  busy: boolean;
  assignees: { userId: string; name: string; isExternal: boolean }[];
  onAssign: (userId: string | null) => void;
}) {
  const t = useTranslations("console");
  /** Fade only colleagues' assignments — unassigned stay fully visible. */
  const muted = Boolean(row.assigneeUserId && !row.isMine);

  return (
    <tr
      className={`border-b border-border/70 align-top ${muted ? "opacity-45" : ""}`}
      data-testid={row.isMine ? "site-assignment-mine" : "site-assignment-other"}
    >
      <td className="px-3 py-3">
        {row.isMine ? (
          <Checkbox
            checked={checked}
            onCheckedChange={() => onToggle()}
            aria-label={row.reference}
          />
        ) : null}
      </td>
      <td className="px-3 py-3">
        <p className="font-mono text-xs font-semibold text-foreground">{row.reference}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {row.inventoryNumber ?? "—"}
        </p>
      </td>
      <td className="px-3 py-3 text-foreground">{row.deviceLabel}</td>
      <td className="px-3 py-3 text-muted-foreground">{row.serviceType}</td>
      <td className="px-3 py-3 text-muted-foreground">{row.locationText}</td>
      <td className="px-3 py-3">
        {row.overdue ? (
          <Badge variant="destructive" className="mb-1">
            {t("sitePortalOverdue")}
          </Badge>
        ) : null}
        <p className="font-mono text-xs">{row.dueAt ?? "—"}</p>
      </td>
      <td className="px-3 py-3">
        <Badge variant="secondary">
          {t(`displayState_${row.displayState}` as "displayState_erfasst")}
        </Badge>
      </td>
      <td className="px-3 py-3">
        {canEditAssignee ? (
          <select
            className="h-8 max-w-[200px] rounded-md border border-border bg-transparent px-2 text-xs"
            value={row.assigneeUserId ?? ""}
            disabled={busy}
            onChange={(e) => onAssign(e.target.value || null)}
            data-testid="site-assignment-assignee"
          >
            <option value="">{t("sitePortalUnassigned")}</option>
            {assignees.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.name}
                {a.isExternal ? " *" : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm">{row.assigneeName ?? "—"}</span>
        )}
      </td>
    </tr>
  );
}
