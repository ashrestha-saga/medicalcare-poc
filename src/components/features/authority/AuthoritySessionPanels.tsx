"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DOSSIER_SECTION_KEYS,
  dossierSectionLabel,
  type DossierSectionKey,
} from "@/constants/authorityDossier";
import type {
  DisclosedEventDTO,
  DisclosureCloseSummaryDTO,
  DisclosureSessionDTO,
} from "@/interfaces";
import type { SiteDTO } from "@/interfaces/device";
import { cn } from "@/lib/utils";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

function formatClock(iso: string): string {
  return iso.slice(11, 16);
}

function formatDateTime(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function remainingParts(expiresAt: string): { hours: number; minutes: number; expired: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { hours: 0, minutes: 0, expired: true };
  return {
    hours: Math.floor(ms / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    expired: false,
  };
}

export function SessionBanner({
  active,
  canManage,
  onOpen,
  onClose,
  shownCount,
}: {
  active: DisclosureSessionDTO | null;
  canManage: boolean;
  onOpen: () => void;
  onClose: () => void;
  shownCount: number;
}) {
  const t = useTranslations("pages.authority");
  const locale = useLocale();
  const dossierLocale = locale.startsWith("de") ? "de" : "en";

  if (!active) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span>
          {t("noSession")} — {t("noSessionHint")}
        </span>
        {canManage ? (
          <Button type="button" size="sm" onClick={onOpen} data-testid="authority-open-session">
            {t("openSession")}
          </Button>
        ) : null}
      </div>
    );
  }

  const rem = remainingParts(active.expiresAt);
  const remaining = rem.expired
    ? t("sessionExpired")
    : t("sessionRemaining", { hours: rem.hours, minutes: rem.minutes });
  const since = formatClock(active.openedAt);
  const scopeLabels = active.scope.map((k) => dossierSectionLabel(k, dossierLocale)).join(", ");
  const siteSuffix = active.siteName
    ? t("sessionSiteSuffix", { site: active.siteName })
    : "";

  return (
    <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {t("sessionRunning", { since, remaining })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-amber-500/30 bg-background/40 px-2 py-0.5">
            {t("sessionShown", { count: shownCount })}
          </span>
          {canManage ? (
            <Button type="button" size="sm" onClick={onClose} data-testid="authority-close-session">
              {t("closeSession")}
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-[11px] opacity-90">
        {t("sessionMeta", { audience: active.audience, site: siteSuffix })}
        {scopeLabels ? ` · ${t("sessionScope", { scope: scopeLabels })}` : null}
      </p>
    </div>
  );
}

export function OpenSessionDialog({
  open,
  onOpenChange,
  busy,
  defaultAudience,
  defaultChecklistCode,
  sites,
  defaultScope,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  defaultAudience: string;
  defaultChecklistCode: string;
  sites: SiteDTO[];
  defaultScope: string[];
  onSubmit: (input: {
    audience: string;
    purpose: string | null;
    participants: string | null;
    durationMinutes: number;
    siteId: string | null;
    checklistCode: string;
    scope: string[];
  }) => Promise<void>;
}) {
  const t = useTranslations("pages.authority");
  const locale = useLocale();
  const dossierLocale = locale.startsWith("de") ? "de" : "en";

  const [audience, setAudience] = useState(defaultAudience);
  const [purpose, setPurpose] = useState("");
  const [participants, setParticipants] = useState("");
  const [durationHours, setDurationHours] = useState("4");
  const [siteId, setSiteId] = useState("");
  const [scope, setScope] = useState<string[]>(defaultScope);

  useEffect(() => {
    if (!open) return;
    setAudience(defaultAudience);
    setPurpose("");
    setParticipants("");
    setDurationHours("4");
    setSiteId(sites[0]?.id ?? "");
    setScope(defaultScope.length ? defaultScope : [...DOSSIER_SECTION_KEYS]);
  }, [open, defaultAudience, defaultScope, sites]);

  const toggleScope = (key: DossierSectionKey) => {
    setScope((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dialog.discloseTitle")}</DialogTitle>
          <DialogDescription>{t("dialog.discloseHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("dialog.audience")}</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("dialog.site")}</Label>
            <select
              className={selectClass}
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">{t("emDash")}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("dialog.purpose")}</Label>
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">{t("dialog.scope")}</Label>
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  className="underline"
                  onClick={() => setScope([...DOSSIER_SECTION_KEYS])}
                >
                  {t("dialog.selectAllScope")}
                </button>
                <button type="button" className="underline" onClick={() => setScope([])}>
                  {t("dialog.clearScope")}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {DOSSIER_SECTION_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={scope.includes(key)}
                    onChange={() => toggleScope(key)}
                  />
                  {dossierSectionLabel(key, dossierLocale)}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("dialog.durationHours")}</Label>
            <Input
              type="number"
              min={0.25}
              max={12}
              step={0.25}
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("dialog.participants")}</Label>
            <Input value={participants} onChange={(e) => setParticipants(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={busy || !audience.trim() || scope.length === 0}
            onClick={() =>
              void onSubmit({
                audience: audience.trim(),
                purpose: purpose.trim() || null,
                participants: participants.trim() || null,
                durationMinutes: Math.round((Number(durationHours) || 4) * 60),
                siteId: siteId || null,
                checklistCode: defaultChecklistCode,
                scope,
              })
            }
            data-testid="authority-session-open-confirm"
          >
            {t("open")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SessionCloseSummary({
  summary,
  onDismiss,
  onRecordInspection,
}: {
  summary: DisclosureCloseSummaryDTO;
  onDismiss: () => void;
  onRecordInspection: () => void;
}) {
  const t = useTranslations("pages.authority");
  const locale = useLocale();
  const dossierLocale = locale.startsWith("de") ? "de" : "en";
  const s = summary.session;
  const siteSuffix = s.siteName ? t("sessionSiteSuffix", { site: s.siteName }) : "";
  const closedHow = s.autoClosed ? t("sessions.autoClosed") : t("sessions.closedManually");
  const durationLabel =
    summary.durationMinutes >= 60
      ? t("sessions.durationHours", {
          hours: Math.round((summary.durationMinutes / 60) * 10) / 10,
        })
      : t("sessions.durationMinutes", { minutes: summary.durationMinutes });

  return (
    <aside
      className="rounded-md border border-emerald-500/30 border-l-4 border-l-emerald-500 bg-card p-4 text-sm"
      data-testid="authority-session-summary"
    >
      <h3 className="font-medium">
        {t("summary.title", { id: s.id.slice(-6).toUpperCase() })}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("summary.meta", {
          audience: s.audience,
          site: siteSuffix,
          from: formatDateTime(s.openedAt),
          to: formatDateTime(s.closedAt ?? s.expiresAt),
          duration: durationLabel,
          closedHow,
        })}
      </p>
      <dl className="mt-3 space-y-2 text-xs">
        <div>
          <dt className="font-medium text-muted-foreground">{t("summary.participants")}</dt>
          <dd>{s.participants?.trim() || t("emDash")}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground">{t("summary.scope")}</dt>
          <dd>
            {s.scope.map((k) => dossierSectionLabel(k, dossierLocale)).join(", ") || t("emDash")}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground">
            {t("summary.shown", { count: summary.disclosed.length })}
          </dt>
          <dd>
            {summary.disclosed.length === 0 ? (
              <span className="text-muted-foreground">{t("sessions.noProtocol")}</span>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {summary.disclosed.map((d) => (
                  <li key={d.id}>
                    {formatClock(d.occurredAt)} · {d.label}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-muted-foreground">{t("summary.gaps")}</dt>
          <dd>
            {summary.gaps.length === 0 ? (
              <span className="text-muted-foreground">{t("summary.noGaps")}</span>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {summary.gaps.map((g) => (
                  <li key={g.code}>
                    {g.label} ({g.count})
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onRecordInspection}>
          {t("summary.recordInspection")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
          {t("summary.dismiss")}
        </Button>
      </div>
    </aside>
  );
}

export function SessionsList({
  sessions,
  disclosedBySession,
  canManage,
  locked,
  onRecordInspection,
}: {
  sessions: DisclosureSessionDTO[];
  disclosedBySession: Record<string, DisclosedEventDTO[]>;
  canManage: boolean;
  locked: boolean;
  onRecordInspection: (session: DisclosureSessionDTO) => void;
}) {
  const t = useTranslations("pages.authority");

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("sessions.empty")}</p>;
  }

  return (
    <div className="space-y-4">
      {sessions.map((s) => {
        const rows = disclosedBySession[s.id] ?? [];
        const rem = remainingParts(s.expiresAt);
        const remaining = rem.expired
          ? t("sessionExpired")
          : t("sessionRemaining", { hours: rem.hours, minutes: rem.minutes });
        const status = s.active
          ? t("sessions.open")
          : s.autoClosed
            ? t("sessions.autoClosed")
            : t("sessions.closedManually");
        const plannedHours = Math.max(
          1,
          Math.round((new Date(s.expiresAt).getTime() - new Date(s.openedAt).getTime()) / 3_600_000),
        );

        return (
          <article
            key={s.id}
            className={cn(
              "space-y-3 rounded-md border border-border p-4",
              s.active && "border-amber-500/40",
            )}
            data-testid={`authority-session-${s.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  {s.id.slice(-6).toUpperCase()} · {status}
                </p>
                <h3 className="font-medium">
                  {s.audience}
                  {s.siteName ? ` · ${s.siteName}` : ""}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    s.purpose,
                    t("sessions.openedAt", { at: formatDateTime(s.openedAt) }),
                    s.active
                      ? t("sessions.remaining", { remaining })
                      : s.closedAt
                        ? t("sessions.closedAt", { at: formatDateTime(s.closedAt) })
                        : null,
                    t("sessions.durationHours", { hours: plannedHours }),
                    s.gapsAtOpening != null
                      ? t("sessions.gapsAtOpening", { count: s.gapsAtOpening })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("sessions.noProtocol")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">{t("sessions.colTime")}</th>
                      <th className="pb-2 pr-3 font-medium">{t("sessions.colView")}</th>
                      <th className="pb-2 font-medium">{t("sessions.colReference")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((d) => (
                      <tr key={d.id} className="border-t border-border">
                        <td className="py-1.5 pr-3 font-mono text-xs">{formatClock(d.occurredAt)}</td>
                        <td className="py-1.5 pr-3">{d.label}</td>
                        <td className="py-1.5 font-mono text-xs text-muted-foreground">
                          {d.resourceId || d.resource}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {canManage && !s.active ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={locked}
                onClick={() => onRecordInspection(s)}
              >
                {t("sessions.recordInspection")}
              </Button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export function useDefaultSessionScope(mapsToSections: Array<string | null | undefined>): string[] {
  return useMemo(() => {
    const fromChecklist = [
      ...new Set(mapsToSections.filter(Boolean) as string[]),
    ];
    return fromChecklist.length ? fromChecklist : [...DOSSIER_SECTION_KEYS];
  }, [mapsToSections]);
}
