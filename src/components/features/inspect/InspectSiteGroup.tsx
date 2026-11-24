"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CataloguePreviewDTO } from "@/interfaces/pruefpartner";
import type { InspectSiteGroup as SiteGroup } from "@/lib/inspect/siteGroups";
import { InspectJobCard } from "@/components/features/inspect/InspectJobCard";
import { useSiteVisitStart } from "@/components/hooks/inspect/useSiteVisitStart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function hhmm(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function InspectSiteGroupCard({
  group,
  done,
  onVisitStarted,
}: {
  group: SiteGroup;
  done?: boolean;
  onVisitStarted?: () => void;
}) {
  const t = useTranslations("pruefpartner");
  const { busy, err, startVisit, endVisit, resumeVisit, startSecondVisit } = useSiteVisitStart({
    siteId: group.siteId,
    visitId: group.visitId,
    references: group.rows.map((r) => r.reference),
    onChanged: onVisitStarted,
  });
  const [secondReason, setSecondReason] = useState<"notfall" | "teile" | "kunde" | "sonstiges">(
    "notfall",
  );
  const [secondNote, setSecondNote] = useState("");

  const visitStarted = Boolean(group.visitStartedAt);
  const visitEnded = Boolean(group.visitCompletedAt);
  const visitRunning = visitStarted && !visitEnded;
  const earliestOverdue =
    Boolean(group.earliestDue) &&
    group.rows.some((r) => r.overdue && r.dueAt === group.earliestDue);

  return (
    <article className="pp-site" data-testid="inspect-site-group">
      <header className="pp-site__head">
        <div>
          <h3 className="pp-site__title">{group.siteName}</h3>
          {group.accessHint ? (
            <p className="pp-site__access">
              <span className="pp-site__access-label">{t("siteAccessLabel")}</span>{" "}
              {group.accessHint}
            </p>
          ) : null}
        </div>
        <p className="pp-site__meta">
          {t("siteDoneSummary", { done: group.doneCount, total: group.rows.length })}
          {group.earliestDue ? (
            <>
              {" · "}
              {t("siteEarliestDue")}{" "}
              <span className={cn(earliestOverdue && "pp-site__due--over")}>
                {group.earliestDue}
              </span>
            </>
          ) : null}
        </p>
      </header>

      {!done && (group.openCount > 0 || visitRunning) ? (
        <div className="pp-site__visit space-y-2" data-testid="inspect-site-visit">
          {!visitStarted && group.openCount > 0 ? (
            <>
              <Button
                type="button"
                className="pp-btn pp-btn--primary"
                disabled={busy}
                onClick={() => void startVisit()}
                data-testid="inspect-start-visit"
              >
                {t("visitStart")}
              </Button>
              <p className="pp-hint">{t("visitStartHint")}</p>
            </>
          ) : null}

          {visitRunning && group.visitId ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  <span className="mono font-medium text-foreground">{group.visitId.slice(0, 12)}</span>
                  {" · "}
                  {t("visitSince", { time: hhmm(group.visitStartedAt) })}
                  {group.visitSequence && group.visitSequence > 1
                    ? ` · ${t("visitSecondLabel")}`
                    : ""}
                </span>
                <Button
                  type="button"
                  className="pp-btn pp-btn--primary"
                  disabled={busy}
                  onClick={() => void endVisit()}
                  data-testid="inspect-end-visit"
                >
                  {t("visitEnd")}
                </Button>
              </div>
              {group.openCount === 0 ? (
                <p className="pp-hint" data-testid="inspect-visit-all-done-hint">
                  {t("visitAllJobsDoneHint")}
                </p>
              ) : null}
            </div>
          ) : null}

          {visitEnded && group.visitId ? (
            <div className="space-y-2" data-testid="inspect-visit-ended">
              <p className="text-sm text-muted-foreground">
                <span className="mono font-medium text-foreground">{group.visitId.slice(0, 12)}</span>
                {" · "}
                {t("visitWindow", {
                  start: hhmm(group.visitStartedAt),
                  end: hhmm(group.visitCompletedAt),
                })}
                {group.setupMinutes != null
                  ? ` · ${t("visitSetupMinutes", { n: group.setupMinutes })}`
                  : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  className="pp-btn pp-btn--primary"
                  disabled={busy}
                  onClick={() => void resumeVisit()}
                  data-testid="inspect-resume-visit"
                >
                  {t("visitResume")}
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3">
                <label className="grid min-w-[10rem] flex-1 gap-1 text-xs text-muted-foreground">
                  {t("visitSecondReason")}
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                    value={secondReason}
                    onChange={(e) =>
                      setSecondReason(e.target.value as typeof secondReason)
                    }
                    data-testid="inspect-second-reason"
                  >
                    <option value="notfall">{t("visitSecondReason_notfall")}</option>
                    <option value="teile">{t("visitSecondReason_teile")}</option>
                    <option value="kunde">{t("visitSecondReason_kunde")}</option>
                    <option value="sonstiges">{t("visitSecondReason_sonstiges")}</option>
                  </select>
                </label>
                <label className="grid min-w-[8rem] flex-1 gap-1 text-xs text-muted-foreground">
                  {t("visitSecondNote")}
                  <Input
                    value={secondNote}
                    onChange={(e) => setSecondNote(e.target.value)}
                    placeholder={t("visitSecondNotePh")}
                    data-testid="inspect-second-note"
                  />
                </label>
                <Button
                  type="button"
                  className="pp-btn"
                  disabled={busy}
                  onClick={() => void startSecondVisit(secondReason, secondNote)}
                  data-testid="inspect-second-visit"
                >
                  {t("visitSecond")}
                </Button>
              </div>
              <p className="pp-hint">{t("visitSecondHint")}</p>
            </div>
          ) : null}

          {err ? <p className="pp-err">{err}</p> : null}
        </div>
      ) : null}

      <ol className="pp-site__jobs">
        {group.rows.map((row: CataloguePreviewDTO, i) => (
          <li key={row.reference} className="pp-site__job">
            <span className="pp-site__idx" aria-hidden>
              {i + 1}
            </span>
            <InspectJobCard row={row} done={done || row.sealed} />
          </li>
        ))}
      </ol>
    </article>
  );
}
