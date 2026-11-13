"use client";

import { useTranslations } from "next-intl";
import { useFollowUpPropose } from "@/components/hooks/inspect/useFollowUpPropose";
import { Button } from "@/components/ui/button";

/** N3 / E33 — propose a Nachbesuch to disposition after a defect. */
export function FollowUpCard({
  reference,
  disabled,
}: {
  reference: string;
  disabled?: boolean;
}) {
  const t = useTranslations("pruefpartner");
  const p = useFollowUpPropose(reference);

  if (p.savedRef) {
    return (
      <div className="pp-note" data-t="ok" data-testid="inspect-followup-done">
        <b>{t("followUpProposed")}</b>{" "}
        <span className="mono">{p.savedRef}</span> · {t("followUpProposedHint")}
      </div>
    );
  }

  return (
    <section className="pp-card" data-testid="inspect-followup">
      <h4>{t("followUpTitle")}</h4>
      <div className="pp-card__body">
        <p className="pp-hint">{t("followUpHint")}</p>
        {!p.open ? (
          <Button
            type="button"
            className="pp-btn"
            disabled={disabled}
            onClick={() => p.setOpen(true)}
          >
            {t("followUpOpen")}
          </Button>
        ) : (
          <div className="pp-nb">
            <div className="pp-nb__grid">
              <div className="pp-nb__fld pp-nb__fld--full">
                <label>{t("followUpParts")}</label>
                <textarea
                  className="pp-textarea"
                  rows={3}
                  value={p.needs}
                  onChange={(e) => p.setNeeds(e.target.value)}
                  placeholder={t("followUpPartsPh")}
                  disabled={p.busy}
                />
              </div>
              <div className="pp-nb__fld">
                <label>{t("followUpDuration")}</label>
                <select
                  value={p.duration}
                  onChange={(e) => p.setDuration(e.target.value)}
                  disabled={p.busy}
                >
                  <option value="30">30 min</option>
                  <option value="60">60 min</option>
                  <option value="90">90 min</option>
                  <option value="120">120 min</option>
                </select>
              </div>
              <div className="pp-nb__fld">
                <label>{t("followUpUrgency")}</label>
                <select
                  value={p.urgency}
                  onChange={(e) => p.setUrgency(e.target.value as "high" | "normal")}
                  disabled={p.busy}
                >
                  <option value="high">{t("followUpUrgencyHigh")}</option>
                  <option value="normal">{t("followUpUrgencyNormal")}</option>
                </select>
              </div>
            </div>
            {p.err ? <div className="pp-err">{p.err}</div> : null}
            <div className="pp-actions">
              <button
                type="button"
                className="pp-btn"
                disabled={p.busy}
                onClick={() => p.setOpen(false)}
              >
                {t("followUpCancel")}
              </button>
              <button
                type="button"
                className="pp-btn pp-btn--primary"
                disabled={p.busy}
                onClick={() => void p.propose()}
              >
                {t("followUpSubmit")}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
