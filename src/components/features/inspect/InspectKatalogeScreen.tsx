"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/http/apiClient";
import { Spinner } from "@/components/ui/Loading";

type Cat = {
  id: string;
  code: string;
  label: string;
  draft: boolean;
  noCatalogue: boolean;
  inspectionTypeCode: string;
};

export function InspectKatalogeScreen() {
  const t = useTranslations("pruefpartner");
  const [rows, setRows] = useState<Cat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ catalogues: Cat[] }>("/api/partner/inspect/catalogues");
        if (!cancelled) setRows(res.catalogues);
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

  const drafts = rows.filter((r) => r.draft);
  const live = rows.filter((r) => !r.draft);

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
