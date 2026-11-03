"use client";

import { useTranslations } from "next-intl";
import type { CataloguePreviewDTO } from "@/interfaces/pruefpartner";
import { OpenButton } from "@/components/features/shared/OpenButton";

export function InspectJobCard({ row, done }: { row: CataloguePreviewDTO; done?: boolean }) {
  const t = useTranslations("pruefpartner");
  return (
    <article className="pp-job" data-testid="inspect-job-card">
      <div className="pp-job__main">
        <h3 className="pp-job__title">{row.deviceLabel}</h3>
        <p className="pp-job__meta mono">
          {row.reference}
          {row.locationText ? ` · ${row.locationText}` : ""}
          {row.scheduledAt
            ? ` · ${t("jobAppointment", { date: row.scheduledAt.slice(0, 10) })}`
            : ""}
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
