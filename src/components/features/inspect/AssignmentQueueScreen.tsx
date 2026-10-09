"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CataloguePreviewDTO } from "@/interfaces/pruefpartner";
import { useAssignmentQueue } from "@/components/hooks/inspect/useAssignmentQueue";
import { OpenButton } from "@/components/features/shared/OpenButton";
import { Spinner } from "@/components/ui/Loading";
import { Button } from "@/components/ui/button";

export function AssignmentQueueScreen() {
  const t = useTranslations("pruefpartner");
  const q = useAssignmentQueue();

  if (!q.tenantId) {
    return (
      <div className="pp-wait">
        <Spinner />
      </div>
    );
  }

  if (q.references.length === 0) {
    return (
      <div className="pp-page">
        <h1 className="pp-title">{t("myAssignments")}</h1>
        <p className="pp-sub">{t("queueEmpty")}</p>
        <Link className="pp-back" href={`/partner/my-sites/${encodeURIComponent(q.tenantId)}`}>
          ← {t("backToConsole")}
        </Link>
      </div>
    );
  }

  return (
    <div className="pp-page" data-testid="inspect-queue">
      <h1 className="pp-title">{t("myAssignments")}</h1>

      {q.error ? <div className="pp-err">{q.error}</div> : null}

      {q.inspectionQueue.length > 0 ? (
        <section className="pp-card" data-q="1">
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
      ) : null}

      {q.loading ? (
        <div className="pp-wait">
          <Spinner />
        </div>
      ) : (
        <>
          {q.openRows.length > 0 ? (
            <section className="pp-card">
              <h4>{t("sectionOpen")}</h4>
              <div className="pp-card__body pp-job-list">
                {q.openRows.map((row) => (
                  <JobCard key={row.reference} row={row} />
                ))}
              </div>
            </section>
          ) : null}
          {q.doneRows.length > 0 ? (
            <section className="pp-card">
              <h4>{t("sectionDone")}</h4>
              <div className="pp-card__body pp-job-list">
                {q.doneRows.map((row) => (
                  <JobCard key={row.reference} row={row} done />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <Link className="pp-back" href={`/partner/my-sites/${encodeURIComponent(q.tenantId)}`}>
        ← {t("backToConsole")}
      </Link>
    </div>
  );
}

function JobCard({ row, done }: { row: CataloguePreviewDTO; done?: boolean }) {
  const t = useTranslations("pruefpartner");
  return (
    <article className="pp-job" data-testid="inspect-job-card">
      <div className="pp-job__main">
        <h3 className="pp-job__title">{row.deviceLabel}</h3>
        <p className="pp-job__meta mono">
          {row.reference} · {row.locationText}
        </p>
        <div className="pp-job__tags">
          <span className="pp-tag" data-t="art">
            {row.catalogue?.label ?? row.serviceType}
          </span>
          {row.catalogue?.noCatalogue ? (
            <span className="pp-tag" data-t="hand">
              {t("noCatalogueBadge")}
            </span>
          ) : null}
          {row.catalogue?.draft ? (
            <span className="pp-tag" data-t="hand">
              {t("draftBadge")}
            </span>
          ) : null}
          {done ? (
            <span className="pp-tag" data-t="done">
              {t("tagDone")}
            </span>
          ) : row.overdue ? (
            <span className="pp-tag" data-t="over">
              {t("tagOverdue", { date: row.dueAt ?? "—" })}
            </span>
          ) : row.dueAt ? (
            <span className="pp-tag" data-t="due">
              {t("tagDue", { date: row.dueAt })}
            </span>
          ) : null}
        </div>
      </div>
      <OpenButton href={`/inspect/${encodeURIComponent(row.reference)}`} className="shrink-0" />
    </article>
  );
}
