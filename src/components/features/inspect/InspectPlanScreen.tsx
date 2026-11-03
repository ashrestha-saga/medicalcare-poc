"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAssignmentQueue } from "@/components/hooks/inspect/useAssignmentQueue";
import { InspectSiteGroupCard } from "@/components/features/inspect/InspectSiteGroup";
import { Spinner } from "@/components/ui/Loading";
import { Button } from "@/components/ui/button";
import { buildDaySections } from "@/lib/inspect/siteGroups";
import type { DayBucket } from "@/lib/inspect/dayBuckets";

type Mode = "heute" | "woche" | "erledigt" | "queue";

const BUCKET_LABEL: Record<DayBucket, string> = {
  heute: "bucketHeute",
  ohne: "bucketOhne",
  morgen: "bucketMorgen",
  woche: "bucketWoche",
  spaeter: "bucketSpaeter",
};

export function InspectPlanScreen({ mode }: { mode: Mode }) {
  const t = useTranslations("pruefpartner");
  const q = useAssignmentQueue();

  const sections = useMemo(() => {
    if (mode === "queue") return [];
    if (mode === "heute") return buildDaySections(q.openRows, "heute");
    if (mode === "woche") return buildDaySections(q.openRows, "woche");
    return buildDaySections(q.openRows, "erledigt", q.doneRows);
  }, [mode, q.openRows, q.doneRows]);

  if (!q.tenantId || q.references.length === 0) {
    return (
      <div className="pp-page" data-testid={`inspect-view-${mode}`}>
        <h1 className="pp-title">{titleFor(mode, t)}</h1>
        <p className="pp-sub">{t("sessionEmpty")}</p>
        <p className="pp-hint">{t("sessionEmptyHint")}</p>
        <Link className="pp-btn pp-btn--primary" href="/partner/my-sites">
          {t("backToConsole")}
        </Link>
      </div>
    );
  }

  return (
    <div className="pp-page" data-testid={`inspect-view-${mode}`}>
      <h1 className="pp-title">{titleFor(mode, t)}</h1>
      <p className="pp-sub">{subFor(mode, t)}</p>

      {q.error ? <div className="pp-err">{q.error}</div> : null}

      {mode === "queue" || mode === "heute" ? (
        q.inspectionQueue.length > 0 ? (
          <section className="pp-card">
            <h4>{t("queueTitle")}</h4>
            <div className="pp-card__body">
              <p className="pp-hint">{t("queueHint")}</p>
              <ul className="pp-queue-list">
                {q.inspectionQueue.map((item) => (
                  <li key={item.id} className="mono">
                    {item.summary}
                  </li>
                ))}
              </ul>
              <Button type="button" className="pp-btn pp-btn--primary" onClick={() => void q.replay()}>
                {t("queueSync")}
              </Button>
            </div>
          </section>
        ) : mode === "queue" ? (
          <div className="pp-note" data-t="ok">
            <b>{t("queueAllSynced")}</b>
            <p className="pp-hint">{t("queueAllSyncedHint")}</p>
          </div>
        ) : null
      ) : null}

      {q.loading ? (
        <div className="pp-wait">
          <Spinner />
        </div>
      ) : mode === "queue" ? null : (
        <>
          {sections.map((sec) =>
            sec.rows.length === 0 ? null : (
              <section key={sec.key} className="pp-day" data-testid={`inspect-day-${sec.key}`}>
                <header className="pp-day__head">
                  <h2 className="pp-day__title">{t(BUCKET_LABEL[sec.key])}</h2>
                  <p className="pp-day__summary">
                    {t("dayDoneSummary", {
                      done: sec.rows.filter((r) => r.sealed).length,
                      total: sec.rows.length,
                      sites: sec.sites.length,
                    })}
                  </p>
                </header>
                <div className="pp-day__sites">
                  {sec.sites.map((site) => (
                    <InspectSiteGroupCard
                      key={site.siteKey}
                      group={site}
                      done={"done" in sec && sec.done}
                      onVisitStarted={() => void q.hydrate()}
                    />
                  ))}
                </div>
              </section>
            ),
          )}
          {sections.every((s) => s.rows.length === 0) ? (
            <div className="pp-note" data-t="ok">
              <b>{emptyFor(mode, t)}</b>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function titleFor(mode: Mode, t: ReturnType<typeof useTranslations<"pruefpartner">>) {
  if (mode === "heute") return t("navHeute");
  if (mode === "woche") return t("navWoche");
  if (mode === "erledigt") return t("navErledigt");
  return t("navQueue");
}

function subFor(mode: Mode, t: ReturnType<typeof useTranslations<"pruefpartner">>) {
  if (mode === "heute") return t("heuteSub");
  if (mode === "woche") return t("wocheSub");
  if (mode === "erledigt") return t("erledigtSub");
  return t("queueSub");
}

function emptyFor(mode: Mode, t: ReturnType<typeof useTranslations<"pruefpartner">>) {
  if (mode === "heute") return t("heuteEmpty");
  if (mode === "woche") return t("wocheEmpty");
  if (mode === "erledigt") return t("erledigtEmpty");
  return t("queueAllSynced");
}
