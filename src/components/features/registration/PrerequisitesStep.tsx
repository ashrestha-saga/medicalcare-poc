"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import type { PrerequisiteItem } from "@/interfaces";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";

export function PrerequisitesStep({
  prerequisites,
  checks,
  setChecks,
  openMandatory,
  busy,
  onBack,
  onRelease,
  releaseLabel,
  releaseDisabled = false,
  beforeActions,
  readyMessage,
  title,
}: {
  prerequisites: PrerequisiteItem[];
  checks: Record<string, boolean>;
  setChecks: Dispatch<SetStateAction<Record<string, boolean>>>;
  openMandatory: PrerequisiteItem[];
  busy: boolean;
  onBack: () => void;
  onRelease: () => void;
  releaseLabel?: string;
  releaseDisabled?: boolean;
  beforeActions?: ReactNode;
  readyMessage?: string;
  title?: string;
}) {
  const t = useTranslations("registration");
  const resolvedTitle = title ?? t("prereqsTitle");
  const resolvedReady = readyMessage ?? t("readyMessage");
  const resolvedRelease = releaseLabel ?? t("createRelease");

  return (
    <section className="p-reg__step-body" data-testid="registration-step-prerequisites">
      <div className="p-reg__card space-y-3">
        <h3 className="p-reg__section">{resolvedTitle}</h3>
        {prerequisites.map((p) => (
          <label key={p.k} className={`flex items-start gap-2 ${p.erfuellt ? "opacity-70" : ""}`}>
            <Checkbox
              checked={Boolean(p.erfuellt || checks[p.k])}
              disabled={Boolean(p.erfuellt) || busy}
              onCheckedChange={(v) => setChecks((c) => ({ ...c, [p.k]: Boolean(v) }))}
            />
            <span>
              <span className="font-medium">
                {p.t}
                {p.pflicht ? <span className="text-[var(--red)]"> *</span> : null}
                {p.erfuellt ? (
                  <span className="ml-1 text-xs text-[var(--on-dark-soft)]">{t("fromSiteData")}</span>
                ) : null}
              </span>
              <span className="block text-xs text-[var(--on-dark-soft)]">
                {p.g} — {p.n}
              </span>
            </span>
          </label>
        ))}
        {openMandatory.length ? (
          <Alert variant="destructive">
            {t("releaseBlocked", { items: openMandatory.map((x) => x.t).join(" · ") })}
          </Alert>
        ) : (
          <Alert>{resolvedReady}</Alert>
        )}
        {beforeActions}
        <div className="p-reg__actions">
          <button type="button" className="p-cta ghost" onClick={onBack}>
            {t("back")}
          </button>
          <button
            type="button"
            className="p-cta"
            onClick={() => void onRelease()}
            disabled={busy || openMandatory.length > 0 || releaseDisabled}
          >
            {resolvedRelease}
          </button>
        </div>
      </div>
    </section>
  );
}
