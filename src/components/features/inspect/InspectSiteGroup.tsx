"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CataloguePreviewDTO } from "@/interfaces/pruefpartner";
import type { InspectSiteGroup as SiteGroup } from "@/lib/inspect/siteGroups";
import { InspectJobCard } from "@/components/features/inspect/InspectJobCard";
import { api, ApiError } from "@/lib/http/apiClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const visitActive = Boolean(group.visitStartedAt);
  const earliestOverdue =
    Boolean(group.earliestDue) &&
    group.rows.some((r) => r.overdue && r.dueAt === group.earliestDue);

  async function startVisit() {
    setBusy(true);
    setErr(null);
    try {
      await api<{ visitId: string; startedAt: string }>("/api/partner/inspect/visits/start", {
        method: "POST",
        body: JSON.stringify({
          siteId: group.siteId,
          references: group.rows.map((r) => r.reference),
        }),
      });
      onVisitStarted?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("visitStartFailed"));
    } finally {
      setBusy(false);
    }
  }

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

      {!done && group.openCount > 0 ? (
        <div className="pp-site__visit">
          <Button
            type="button"
            className="pp-btn pp-btn--primary"
            disabled={busy}
            onClick={() => void startVisit()}
            data-testid="inspect-start-visit"
          >
            {visitActive ? t("visitResume") : t("visitStart")}
          </Button>
          <p className="pp-hint">
            {visitActive ? t("visitResumeHint") : t("visitStartHint")}
          </p>
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
