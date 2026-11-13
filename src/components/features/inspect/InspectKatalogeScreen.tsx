"use client";

import { useTranslations } from "next-intl";
import { useInspectKataloge } from "@/components/hooks/inspect/useInspectKataloge";
import { Spinner } from "@/components/ui/Loading";

export function InspectKatalogeScreen() {
  const t = useTranslations("pruefpartner");
  const { drafts, live, error, loading } = useInspectKataloge();

  if (loading) {
    return (
      <div className="pp-wait">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="pp-page" data-testid="inspect-view-kataloge">
      <h1 className="pp-title">{t("navKataloge")}</h1>
      <p className="pp-sub">{t("katalogeSub")}</p>
      {error ? <div className="pp-err">{error}</div> : null}
      <section className="pp-card">
        <h4>
          {t("katalogeDraft")} · {drafts.length}
        </h4>
        <div className="pp-zg-list">
          {drafts.length === 0 ? (
            <p className="pp-hint" style={{ padding: "0.75rem 1rem" }}>
              {t("katalogeNoDraft")}
            </p>
          ) : (
            drafts.map((c) => (
              <div key={c.id} className="pp-zg">
                <div>
                  <b>{c.label}</b>
                  <span className="beleg mono">
                    {c.code} · {c.inspectionTypeCode}
                  </span>
                </div>
                <span className="st" data-s="warn">
                  {t("draftBadge")}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="pp-card">
        <h4>
          {t("katalogeLive")} · {live.length}
        </h4>
        <div className="pp-zg-list">
          {live.slice(0, 40).map((c) => (
            <div key={c.id} className="pp-zg">
              <div>
                <b>{c.label}</b>
                <span className="beleg mono">
                  {c.code} · {c.inspectionTypeCode}
                </span>
              </div>
              {c.noCatalogue ? (
                <span className="st" data-s="ok">
                  {t("noCatalogueBadge")}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
