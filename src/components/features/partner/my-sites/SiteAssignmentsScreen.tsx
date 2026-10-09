"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { DispositionDisplayState, SiteAssignmentRowDTO } from "@/interfaces/console";
import { useSiteAssignments } from "@/components/hooks/partner/my-sites/useSiteAssignments";
import { BarcodeCapture } from "@/components/features/shared/barcode-capture";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";
import { cn } from "@/lib/utils";

function siteStateBadgeClass(state: DispositionDisplayState): string {
  if (state === "abgeschlossen") {
    return "border-transparent bg-[rgba(47,217,138,0.18)] text-[var(--green)]";
  }
  if (state === "abgelehnt") {
    return "border-transparent bg-[rgba(255,51,102,0.14)] text-[var(--red)]";
  }
  if (state === "in_arbeit") {
    return "border-transparent bg-[rgba(245,165,36,0.18)] text-[var(--warn)]";
  }
  if (state === "terminiert") {
    return "border-transparent bg-[rgba(30,127,224,0.14)] text-[var(--accent)]";
  }
  if (state === "zugewiesen") {
    return "border-transparent bg-[rgba(139,92,246,0.14)] text-violet-700";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function SiteAssignmentsScreen({ tenantId }: { tenantId: string }) {
  const t = useTranslations("console");
  const {
    data,
    error,
    loading,
    canAssign,
    isAdmin,
    scanActive,
    applyScan,
    clearScan,
    selected,
    busyRef,
    visible,
    selectableMine,
    toggle,
    selectAllMine,
    onSelectInspections,
    patchAssignment,
  } = useSiteAssignments(tenantId);

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
          <div className="mt-2 space-y-2">
            <BarcodeCapture
              data-testid="site-portal-scan"
              placeholder={t("sitePortalVerifyPlaceholder")}
              submitLabel={t("sitePortalScan")}
              onCapture={(result) => applyScan(result.raw)}
            />
            {scanActive ? (
              <Button type="button" variant="ghost" size="sm" className="h-8" onClick={clearScan}>
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
                {visible.map((row) => {
                  const completed =
                    row.displayState === "abgeschlossen" || row.displayState === "abgelehnt";
                  return (
                    <AssignmentRow
                      key={row.reference}
                      row={row}
                      checked={selected.has(row.reference)}
                      selectable={row.isMine && !completed}
                      onToggle={() => toggle(row.reference, row.isMine, completed)}
                      canEditAssignee={
                        canAssign &&
                        row.isExecutor &&
                        !completed &&
                        (row.isMine || (isAdmin && !row.assigneeUserId))
                      }
                      busy={busyRef === row.reference}
                      assignees={data?.assignees ?? []}
                      onAssign={(userId) =>
                        void patchAssignment(row.reference, { assigneeUserId: userId })
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={selectAllMine}
            disabled={selectableMine.length === 0}
          >
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
  selectable,
  onToggle,
  canEditAssignee,
  busy,
  assignees,
  onAssign,
}: {
  row: SiteAssignmentRowDTO;
  checked: boolean;
  selectable: boolean;
  onToggle: () => void;
  canEditAssignee: boolean;
  busy: boolean;
  assignees: { userId: string; name: string; isExternal: boolean }[];
  onAssign: (userId: string | null) => void;
}) {
  const t = useTranslations("console");
  /** Fade colleagues' assignments and completed rows that cannot be selected. */
  const muted = Boolean((row.assigneeUserId && !row.isMine) || !selectable && row.isMine);

  return (
    <tr
      className={`border-b border-border/70 align-top ${muted ? "opacity-55" : ""}`}
      data-testid={row.isMine ? "site-assignment-mine" : "site-assignment-other"}
    >
      <td className="px-3 py-3">
        {row.isMine ? (
          <Checkbox
            checked={checked}
            disabled={!selectable}
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
        {row.overdue && row.displayState !== "abgeschlossen" ? (
          <Badge variant="destructive" className="mb-1">
            {t("sitePortalOverdue")}
          </Badge>
        ) : null}
        <p className="font-mono text-xs">{row.dueAt ?? "—"}</p>
      </td>
      <td className="px-3 py-3">
        <Badge
          variant={row.displayState === "abgeschlossen" ? "success" : "outline"}
          className={cn(siteStateBadgeClass(row.displayState))}
        >
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
