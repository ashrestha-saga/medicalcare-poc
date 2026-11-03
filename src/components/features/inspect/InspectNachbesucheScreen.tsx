"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/http/apiClient";
import type { InspectFollowUpListDTO, InspectFollowUpStatus } from "@/interfaces/pruefpartner";
import { Spinner } from "@/components/ui/Loading";

const STATUS_KEY: Record<InspectFollowUpStatus, string> = {
  waiting: "nachbesucheStatusWaiting",
  assigned: "nachbesucheStatusAssigned",
  scheduled: "nachbesucheStatusScheduled",
  in_progress: "nachbesucheStatusInProgress",
  done: "nachbesucheStatusDone",
};

/** Follow-up proposals created from failed inspection steps — status only; scheduling in disposition. */
export function InspectNachbesucheScreen() {
  const t = useTranslations("pruefpartner");
  const [data, setData] = useState<InspectFollowUpListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api<InspectFollowUpListDTO>("/api/partner/inspect/follow-ups");
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : t("loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <div className="pp-wait">
        <Spinner />
      </div>
    );
  }

  const rows = data?.rows ?? [];

  return (
    <div className="pp-page" data-testid="inspect-view-nachbesuche">
      <h1 className="pp-title">{t("navNachbesuche")}</h1>
      <p className="pp-sub">{t("nachbesucheSub")}</p>
      {error ? <div className="pp-err">{error}</div> : null}

      {rows.length === 0 && !error ? (
        <div className="pp-note" data-t="ok">
          <b>{t("nachbesucheEmpty")}</b>
          <p className="pp-hint">{t("nachbesucheEmptyHint")}</p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="pp-job-list" data-testid="inspect-nachbesuche-list">
          {rows.map((row) => (
            <article key={row.reference} className="pp-job" data-testid="inspect-nachbesuche-row">
              <div className="pp-job__title">{row.deviceLabel}</div>
              <div className="pp-job__meta">
                <span className="mono">{row.reference}</span>
                {row.parentReference ? (
                  <>
                    {" "}
                    · {t("nachbesucheParent")}{" "}
                    <span className="mono">{row.parentReference}</span>
                  </>
                ) : null}
                {row.tenantName ? <> · {row.tenantName}</> : null}
              </div>
              <div className="pp-job__tags">
                <span className="pp-tag" data-status={row.status}>
                  {t(STATUS_KEY[row.status] as "nachbesucheStatusWaiting")}
                </span>
                {row.followUpUrgency === "high" ? (
                  <span className="pp-tag">{t("nachbesucheUrgencyHigh")}</span>
                ) : null}
                {row.assigneeName ? <span className="pp-tag">{row.assigneeName}</span> : null}
              </div>
              {row.followUpNeeds ? (
                <p className="pp-hint" style={{ marginTop: "0.45rem" }}>
                  {row.followUpNeeds.length > 160
                    ? `${row.followUpNeeds.slice(0, 160)}…`
                    : row.followUpNeeds}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      <div className="pp-actions" style={{ marginTop: "1rem" }}>
        <Link className="pp-btn pp-btn--primary" href="/partner/orders?tab=disposition">
          {t("nachbesucheOpenDisposition")}
        </Link>
        <Link className="pp-btn" href="/partner/my-sites">
          {t("backToConsole")}
        </Link>
      </div>
    </div>
  );
}
