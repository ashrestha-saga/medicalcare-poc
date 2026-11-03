"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/http/apiClient";
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
  const [open, setOpen] = useState(false);
  const [needs, setNeeds] = useState("");
  const [duration, setDuration] = useState("60");
  const [urgency, setUrgency] = useState<"high" | "normal">("normal");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedRef, setSavedRef] = useState<string | null>(null);

  async function propose() {
    const text = needs.trim();
    if (!text) {
      setErr(t("followUpNeedsRequired"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ reference: string }>(
        `/api/partner/disposition/${encodeURIComponent(reference)}/follow-up`,
        {
          method: "POST",
          body: JSON.stringify({
            followUpNeeds: `${text}\n(${t("followUpDuration")}: ${duration} min)`,
            followUpUrgency: urgency,
            reason: "instandsetzung",
          }),
        },
      );
      setSavedRef(res.reference);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("followUpFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (savedRef) {
    return (
      <div className="pp-note" data-t="ok" data-testid="inspect-followup-done">
        <b>{t("followUpProposed")}</b>{" "}
        <span className="mono">{savedRef}</span> · {t("followUpProposedHint")}
      </div>
    );
  }

  return (
    <section className="pp-card" data-testid="inspect-followup">
      <h4>{t("followUpTitle")}</h4>
      <div className="pp-card__body">
        <p className="pp-hint">{t("followUpHint")}</p>
        {!open ? (
          <Button
            type="button"
            className="pp-btn"
            disabled={disabled}
            onClick={() => setOpen(true)}
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
                  value={needs}
                  onChange={(e) => setNeeds(e.target.value)}
                  placeholder={t("followUpPartsPh")}
                  disabled={busy}
                />
              </div>
              <div className="pp-nb__fld">
                <label>{t("followUpDuration")}</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  disabled={busy}
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
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as "high" | "normal")}
                  disabled={busy}
                >
                  <option value="high">{t("followUpUrgencyHigh")}</option>
                  <option value="normal">{t("followUpUrgencyNormal")}</option>
                </select>
              </div>
            </div>
            {err ? <div className="pp-err">{err}</div> : null}
            <div className="pp-actions">
              <button type="button" className="pp-btn" disabled={busy} onClick={() => setOpen(false)}>
                {t("followUpCancel")}
              </button>
              <button
                type="button"
                className="pp-btn pp-btn--primary"
                disabled={busy}
                onClick={() => void propose()}
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
