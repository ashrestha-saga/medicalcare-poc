"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  RecordNotificationModal,
  type NotificationSubject,
} from "@/components/features/authority/RecordNotificationModal";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import {
  useIncidentsList,
  type IncidentView,
} from "@/components/hooks/incidents/useIncidentsList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DeviceIncidentDTO } from "@/interfaces";
import { api } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { cn } from "@/lib/utils";

const VIEWS: IncidentView[] = ["all", "unassessed", "unreported", "open"];

type AssessChoice = true | false | null;
type UserOpt = { id: string; name: string; role: string | null };

function daysSince(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  const today = new Date();
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.max(0, Math.floor((utcToday - d.getTime()) / 86_400_000));
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function Chip({
  tone,
  children,
}: {
  tone: "warn" | "stop" | "ok";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        tone === "warn" && "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100",
        tone === "stop" && "bg-red-100 text-red-950 dark:bg-red-950/50 dark:text-red-100",
        tone === "ok" && "bg-emerald-100 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100",
      )}
    >
      {children}
    </span>
  );
}

export function IncidentsScreen() {
  const t = useTranslations("pages.incidents");
  const tn = useTranslations("pages.authorityNotification");
  const { permissionData } = usePermissions();
  const list = useIncidentsList();
  const maskRef = useRef<HTMLDivElement>(null);

  const [maskTarget, setMaskTarget] = useState<DeviceIncidentDTO | null>(null);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [notifySubject, setNotifySubject] = useState<NotificationSubject | null>(null);

  const [serious, setSerious] = useState<AssessChoice | undefined>(undefined);
  const [note, setNote] = useState("");
  const [reportedTo, setReportedTo] = useState("");
  const [channel, setChannel] = useState("");
  const [reportedAt, setReportedAt] = useState("");
  const [reference, setReference] = useState("");
  const [manufacturerAt, setManufacturerAt] = useState("");

  useEffect(() => {
    if (!maskTarget) return;
    void api<{ users: UserOpt[] }>("/api/users/options?active=true")
      .then((res) => setUsers(res.users))
      .catch(() => setUsers([]));
  }, [maskTarget]);

  useEffect(() => {
    if (!maskTarget || !maskRef.current) return;
    maskRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [maskTarget]);

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="incidents-denied">
        <main className="p-main">
          <ListPageShell title={t("title")} description={t("denied")}>
            <p className="text-sm text-muted-foreground">{t("denied")}</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  const assessorLabel =
    maskTarget?.assessedBy ||
    (permissionData?.role ? String(permissionData.role).replace(/_/g, " ") : "—");

  const openMask = (inc: DeviceIncidentDTO) => {
    setMaskTarget(inc);
    setSerious(inc.assessedAt != null ? inc.suspectedSerious : undefined);
    setNote(inc.assessmentNote ?? "");
    setReportedTo(inc.reportedTo ?? "");
    setChannel(inc.reportedAt ? "authority_portal" : "");
    setReportedAt(inc.reportedAt ?? "");
    setReference(inc.reportReference ?? "");
    setManufacturerAt(inc.manufacturerNotifiedAt ?? "");
    setAssigneeId(inc.assignedUserId ?? "");
    setAssignDue(inc.assignmentDueAt ?? "");
  };

  const closeMask = () => setMaskTarget(null);

  const submitMask = async () => {
    if (!maskTarget || serious === undefined) return;
    if (serious === false && !note.trim()) return;
    setBusy(true);
    try {
      const wantReport =
        serious === true && !!reportedAt && !!reportedTo && !!channel && !maskTarget.reportedAt;
      const mfrAt =
        manufacturerAt ||
        (wantReport && /Hersteller/i.test(reportedTo) ? reportedAt : null);
      await list.assessAndMaybeReport(maskTarget.id, {
        suspectedSerious: serious,
        assessmentNote: note.trim() || null,
        report: wantReport
          ? {
              reportedAt,
              reportedTo: reportedTo.trim(),
              channel,
              reportReference: reference.trim() || null,
              manufacturerNotifiedAt: mfrAt,
            }
          : null,
      });
      const assignChanged =
        !!assigneeId &&
        (assigneeId !== (maskTarget.assignedUserId ?? "") ||
          (assignDue || "") !== (maskTarget.assignmentDueAt ?? ""));
      if (assignChanged) {
        await list.assign(maskTarget.id, assigneeId, assignDue || null);
      }
      setMaskTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const severityChip = (inc: DeviceIncidentDTO) => {
    if (inc.suspectedSerious === null && !inc.assessedAt) {
      return <Chip tone="warn">{t("chip.unassessed")}</Chip>;
    }
    if (inc.suspectedSerious === null) {
      return <Chip tone="warn">{t("chip.undecided")}</Chip>;
    }
    if (inc.suspectedSerious) {
      return <Chip tone="stop">{t("chip.serious")}</Chip>;
    }
    return <Chip tone="ok">{t("chip.notSerious")}</Chip>;
  };

  const reportCell = (inc: DeviceIncidentDTO) => {
    if (inc.suspectedSerious !== true) {
      return <span className="text-muted-foreground">{t("report.none")}</span>;
    }
    if (inc.reportedAt) {
      return (
        <span>
          <b>{formatDate(inc.reportedAt)}</b>
          {inc.reportedTo ? ` · ${inc.reportedTo}` : ""}
          {inc.manufacturerNotifiedAt ? (
            <span className="mt-0.5 block text-muted-foreground">
              {t("report.manufacturer", { date: formatDate(inc.manufacturerNotifiedAt) })}
            </span>
          ) : null}
        </span>
      );
    }
    return <Chip tone="stop">{t("chip.unreported")}</Chip>;
  };

  const selectClass =
    "flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm";

  return (
    <div className="p-work" data-testid="incidents-page">
      <main className="p-main">
        <ListPageShell title={t("title")} description={t("description")}>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div
              className={cn(
                "rounded-md border border-border bg-card p-3",
                list.kpis.unassessed > 0 && "border-amber-400/60",
              )}
              data-testid="incidents-kpi-unassessed"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {t("kpi.unassessed")}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{list.kpis.unassessed}</p>
              <p className="text-xs text-muted-foreground">{t("kpi.unassessedHint")}</p>
            </div>
            <div
              className={cn(
                "rounded-md border border-border bg-card p-3",
                list.kpis.unreported > 0 && "border-amber-400/60",
              )}
              data-testid="incidents-kpi-unreported"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {t("kpi.unreported")}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{list.kpis.unreported}</p>
              <p className="text-xs text-muted-foreground">{t("kpi.unreportedHint")}</p>
            </div>
            <div className="rounded-md border border-border bg-card p-3" data-testid="incidents-kpi-total">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {t("kpi.total")}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{list.kpis.total}</p>
              <p className="text-xs text-muted-foreground">{t("kpi.totalHint")}</p>
            </div>
          </div>

          {list.kpis.unassessed > 0 ? (
            <div className="mb-4 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-50">
              <b>{t("banner.unassessedTitle", { count: list.kpis.unassessed })}</b>{" "}
              {t("banner.unassessedBody")}
            </div>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-2">
            {VIEWS.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={list.view === key ? "default" : "outline"}
                className={cn(list.view === key && "pointer-events-none")}
                onClick={() => list.setView(key)}
                data-testid={`incidents-view-${key}`}
              >
                {t(`views.${key}`)}
              </Button>
            ))}
          </div>

          {/* Inline assess mask — opens above the table for the selected incident (v25). */}
          {maskTarget ? (
            <div
              ref={maskRef}
              className="mb-4 rounded-md border border-border border-l-[3px] border-l-primary bg-card shadow-sm"
              data-testid="incident-assess-mask"
            >
              <div className="px-4 pt-3.5 text-[14px] font-bold">
                {t("mask.title", {
                  code: maskTarget.inventoryNumber ?? t("modelLevel"),
                })}
              </div>
              <div className="px-4 pt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                <b className="text-foreground">{formatDate(maskTarget.occurredAt)}</b>
                {maskTarget.deviceLabel ? ` · ${maskTarget.deviceLabel}` : ""}
                <br />
                {maskTarget.description}
              </div>

              <div className="space-y-4 px-4 pb-1 pt-4">
                <div>
                  <p className="mb-2 text-[12.5px] font-semibold">{t("mask.question")}</p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        [true, t("mask.yes"), "stop"],
                        [false, t("mask.no"), "ok"],
                        [null, t("mask.undecided"), "warn"],
                      ] as const
                    ).map(([val, label, tone]) => {
                      const pressed = serious === val;
                      return (
                        <button
                          key={String(val)}
                          type="button"
                          aria-pressed={pressed}
                          className={cn(
                            "min-w-[140px] flex-1 rounded-md border border-border px-3 py-2.5 text-left text-[12.5px] font-medium transition-colors",
                            !pressed && "bg-background hover:border-primary",
                            pressed && tone === "stop" && "border-red-700 bg-red-700 text-white",
                            pressed && tone === "ok" && "border-emerald-700 bg-emerald-700 text-white",
                            pressed && tone === "warn" && "border-amber-700 bg-amber-700 text-white",
                          )}
                          onClick={() => setSerious(val)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{t("mask.hint")}</p>
                </div>

                {serious === false ? (
                  <div className="space-y-1">
                    <Label htmlFor="assess-note">{t("mask.reason")}</Label>
                    <Textarea
                      id="assess-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {t("mask.assessedBy")}
                    </Label>
                    <Input
                      value={
                        maskTarget.assessedBy
                          ? maskTarget.assessedBy
                          : t("mask.assessedByPending", { role: assessorLabel })
                      }
                      readOnly
                      className="h-9 bg-muted/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {t("mask.assessedAt")}
                    </Label>
                    <Input
                      value={maskTarget.assessedAt ?? todayIso()}
                      readOnly
                      className="h-9 bg-muted/40"
                    />
                  </div>
                </div>

                {serious === true ? (
                  <div className="space-y-3 border-t border-border pt-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-muted-foreground">
                      {t("mask.reportSection")}
                    </p>
                    <div className="rounded-md border border-amber-300/40 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/25 dark:text-amber-50">
                      {t("mask.reportModelNote")}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="rep-to">{t("mask.recipient")}</Label>
                        <select
                          id="rep-to"
                          className={selectClass}
                          value={reportedTo}
                          onChange={(e) => setReportedTo(e.target.value)}
                          disabled={!!maskTarget.reportedAt}
                        >
                          <option value="">{t("mask.choose")}</option>
                          <option value="BfArM">BfArM</option>
                          <option value="Hersteller">{t("mask.manufacturer")}</option>
                          <option value="BfArM und Hersteller">{t("mask.both")}</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="rep-ch">{t("mask.channel")}</Label>
                        <select
                          id="rep-ch"
                          className={selectClass}
                          value={channel}
                          onChange={(e) => setChannel(e.target.value)}
                          disabled={!!maskTarget.reportedAt}
                        >
                          <option value="">{t("mask.choose")}</option>
                          <option value="authority_portal">{t("channel.portal")}</option>
                          <option value="email">{t("channel.email")}</option>
                          <option value="post">{t("channel.post")}</option>
                          <option value="fax">{t("channel.fax")}</option>
                          <option value="other">{t("channel.other")}</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="rep-at">{t("mask.sentAt")}</Label>
                        <Input
                          id="rep-at"
                          type="date"
                          className="h-9"
                          value={reportedAt}
                          onChange={(e) => setReportedAt(e.target.value)}
                          disabled={!!maskTarget.reportedAt}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="rep-ref">{t("mask.ref")}</Label>
                        <Input
                          id="rep-ref"
                          className="h-9"
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          disabled={!!maskTarget.reportedAt}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="rep-mfr">{t("mask.manufacturerAt")}</Label>
                        <Input
                          id="rep-mfr"
                          type="date"
                          className="h-9"
                          value={manufacturerAt}
                          onChange={(e) => setManufacturerAt(e.target.value)}
                          disabled={!!maskTarget.reportedAt}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("mask.mpamivHint", { days: daysSince(maskTarget.noticedAt) })}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-3 border-t border-border pt-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-muted-foreground">
                    {t("assign.title")}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("assign.hint")}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="assignee">{t("assign.user")}</Label>
                      <select
                        id="assignee"
                        className={selectClass}
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                      >
                        <option value="">{t("mask.choose")}</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                            {u.role ? ` · ${u.role}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="assign-due">{t("assign.due")}</Label>
                      <Input
                        id="assign-due"
                        type="date"
                        className="h-9"
                        value={assignDue}
                        onChange={(e) => setAssignDue(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-3">
                <Button
                  type="button"
                  disabled={busy || serious === undefined || (serious === false && !note.trim())}
                  onClick={() => void submitMask()}
                >
                  {t("actions.save")}
                </Button>
                <Button type="button" variant="outline" onClick={closeMask}>
                  {t("actions.cancel")}
                </Button>
              </div>
            </div>
          ) : null}

          {list.loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : list.incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border bg-card">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">{t("col.date")}</th>
                    <th className="px-3 py-2.5">{t("col.device")}</th>
                    <th className="px-3 py-2.5">{t("col.incident")}</th>
                    <th className="px-3 py-2.5">{t("col.severity")}</th>
                    <th className="px-3 py-2.5">{t("col.report")}</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {list.incidents.map((inc) => {
                    const selected = maskTarget?.id === inc.id;
                    return (
                      <tr
                        key={inc.id}
                        className={cn(
                          "border-b border-border last:border-0",
                          selected && "bg-muted/40",
                        )}
                        data-testid={`incident-${inc.id}`}
                      >
                        <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">
                          {formatDate(inc.occurredAt)}
                        </td>
                        <td className="px-3 py-3">
                          <b className="font-mono text-xs">
                            {inc.inventoryNumber ?? t("modelLevel")}
                          </b>
                          {inc.deviceLabel ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {inc.deviceLabel}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <span>{inc.description}</span>
                          {inc.harmDescription ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {inc.harmDescription}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          {severityChip(inc)}
                          {inc.assessedBy && inc.assessedAt ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {inc.assessedBy}, {formatDate(inc.assessedAt)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-xs">{reportCell(inc)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="flex flex-col items-end gap-1">
                            {list.canManage && !inc.closedAt ? (
                              <button
                                type="button"
                                className="text-[12.5px] font-semibold text-primary hover:underline"
                                data-testid={`incident-assess-${inc.id}`}
                                onClick={() => openMask(inc)}
                              >
                                {t("actions.assess")}
                              </button>
                            ) : inc.closedAt ? (
                              <span className="text-xs text-muted-foreground">
                                {t("closed", { date: formatDate(inc.closedAt) })}
                              </span>
                            ) : null}
                            {list.canManage &&
                            inc.suspectedSerious === true &&
                            !inc.reportedAt &&
                            !inc.closedAt ? (
                              <button
                                type="button"
                                className="text-[12.5px] font-semibold text-primary hover:underline"
                                data-testid={`incident-notify-${inc.id}`}
                                onClick={() =>
                                  setNotifySubject({
                                    type: "incident",
                                    id: inc.id,
                                    defaultSubject: `Vorkommnismeldung ${inc.id}`,
                                    defaultBody: inc.description,
                                  })
                                }
                              >
                                {tn("record")}
                              </button>
                            ) : null}
                          </div>
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

      <RecordNotificationModal
        open={!!notifySubject}
        onOpenChange={(o) => !o && setNotifySubject(null)}
        subject={notifySubject}
        onRecorded={() => void list.refresh()}
      />
    </div>
  );
}
