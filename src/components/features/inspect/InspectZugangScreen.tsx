"use client";

import { useTranslations } from "next-intl";
import { useInspectZugang } from "@/components/hooks/inspect/useInspectZugang";
import { Spinner } from "@/components/ui/Loading";

const GROUP_ORDER = [
  "qualification",
  "skill",
  "equipment",
  "commission",
  "liability",
  "membership",
] as const;

export function InspectZugangScreen() {
  const t = useTranslations("pruefpartner");
  const { data, error, loading } = useInspectZugang();

  if (loading) {
    return (
      <div className="pp-wait">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="pp-page" data-testid="inspect-view-zugang">
      <h1 className="pp-title">{t("navZugang")}</h1>
      <p className="pp-sub">{t("zugangSub")}</p>
      {error ? <div className="pp-err">{error}</div> : null}
      {data ? (
        <>
          {data.warningCount > 0 ? (
            <div className="pp-note" data-t="warn">
              <b>{t("zugangWarn", { count: data.warningCount })}</b>
              <p className="pp-hint">{t("zugangWarnHint")}</p>
            </div>
          ) : (
            <div className="pp-note" data-t="ok">
              <b>{t("zugangOk")}</b>
            </div>
          )}
          <section className="pp-card">
            <h4>{t("zugangSignedIn")}</h4>
            <div className="pp-card__body">
              <div className="pp-line">
                <span>{t("zugangName")}</span>
                <b>{data.name}</b>
              </div>
              <div className="pp-line">
                <span>{t("zugangOrg")}</span>
                <b>{data.organisationName}</b>
              </div>
              <div className="pp-line">
                <span>{t("zugangRole")}</span>
                <b>
                  {data.roleLabel === "external" ? t("zugangRoleExternal") : t("zugangRoleTech")}
                </b>
              </div>
            </div>
          </section>
          {GROUP_ORDER.map((g) => {
            const rows = data.rows.filter((r) => r.group === g);
            if (!rows.length) return null;
            return (
              <section key={g} className="pp-card">
                <h4>{t(`zugangGroup_${g}`)}</h4>
                <div className="pp-zg-list">
                  {rows.map((r, i) => (
                    <div key={`${g}-${i}`} className="pp-zg">
                      <div>
                        <b>{r.title}</b>
                        <span className="beleg">{r.evidence ?? "—"}</span>
                      </div>
                      <span className="bis mono">{r.validTo ?? "—"}</span>
                      <span className="st" data-s={r.status}>
                        {r.status === "stop"
                          ? t("zugangExpired")
                          : r.status === "warn"
                            ? t("zugangExpiring", { days: r.daysLeft ?? 0 })
                            : t("zugangValid")}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
