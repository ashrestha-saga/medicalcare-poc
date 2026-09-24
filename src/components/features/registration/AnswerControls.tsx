"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { FieldAnswerMeta } from "@/interfaces";
import { isAnswered } from "@/components/hooks/registration/registrationHelpers";

/** Peach banner under a suggested select/number — “Accept proposal” (mockup). */
export function ProposalBanner({ onAccept }: { onAccept: () => void }) {
  const t = useTranslations("registration");
  return (
    <div className="p-reg__proposal-banner" data-testid="proposal-banner">
      <span className="p-reg__proposal-banner-text">{t("proposalBanner")}</span>
      <button type="button" className="p-reg__proposal-accept" onClick={onAccept}>
        {t("acceptProposal")}
      </button>
    </div>
  );
}

/** FA-209 Yes/No row: label left, buttons right; dashed orange on suggested value. */
export function YesNoAnswer({
  label,
  hint,
  value,
  meta,
  onAnswer,
  onConfirm,
  disabled,
  testId,
}: {
  label: string;
  hint?: string;
  value: boolean | undefined;
  meta: FieldAnswerMeta | undefined;
  onAnswer: (value: boolean) => void;
  onConfirm?: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  const t = useTranslations("registration");
  const suggested = meta?.state === "vorschlag";
  const answered = isAnswered(meta);
  const open = !meta || meta.state === "offen" || (!answered && !suggested);
  const suggestedYes = suggested && value === true;
  const suggestedNo = suggested && value === false;
  const proposalAnswer = value === false ? t("no") : t("yes");

  return (
    <div
      className="p-reg__yn-row"
      data-testid={testId}
      data-state={meta?.state ?? "offen"}
    >
      <div className="p-reg__yn-copy">
        <span className="p-reg__yn-label">{label}</span>
        {hint ? <span className="p-reg__yn-hint">{hint}</span> : null}
        {suggested ? (
          <span className="p-reg__proposal-inline">
            {t("proposalInline", { answer: proposalAnswer })}
          </span>
        ) : null}
        {open ? <span className="p-reg__pill-open">{t("notAnswered")}</span> : null}
      </div>
      <div className="p-reg__yn" role="group" aria-label={label}>
        <button
          type="button"
          className="p-reg__yn-btn"
          data-active={answered && value === true ? "1" : "0"}
          data-suggest={suggestedYes ? "1" : "0"}
          disabled={disabled}
          onClick={() => {
            if (suggestedYes && onConfirm) onConfirm();
            else onAnswer(true);
          }}
        >
          {t("yes")}
        </button>
        <button
          type="button"
          className="p-reg__yn-btn"
          data-active={answered && value === false ? "1" : "0"}
          data-suggest={suggestedNo ? "1" : "0"}
          disabled={disabled}
          onClick={() => {
            if (suggestedNo && onConfirm) onConfirm();
            else onAnswer(false);
          }}
        >
          {t("no")}
        </button>
      </div>
    </div>
  );
}

/** Select/number field with optional proposal banner underneath. */
export function SuggestableField({
  label,
  meta,
  onConfirm,
  hideBanner,
  children,
}: {
  label?: string;
  meta: FieldAnswerMeta | undefined;
  onConfirm?: () => void;
  /** When parent renders a shared ProposalBanner (e.g. maintenance pair). */
  hideBanner?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("registration");
  const suggested = meta?.state === "vorschlag";
  const answered = isAnswered(meta);
  const open = !meta || meta.state === "offen" || (!answered && !suggested);

  return (
    <div className="p-reg__field-block" data-state={meta?.state ?? "offen"}>
      {label ? (
        <div className="p-reg__field-label-row">
          <span className="p-reg__field-label">{label}</span>
          {open ? <span className="p-reg__pill-open">{t("notAnswered")}</span> : null}
        </div>
      ) : null}
      <div className="p-reg__field-control">{children}</div>
      {suggested && onConfirm && !hideBanner ? <ProposalBanner onAccept={onConfirm} /> : null}
    </div>
  );
}

/** Bottom summary: confirmed / proposals / unanswered + confirm-all (mockup). */
export function ProposalSummaryCard({
  confirmed,
  proposals,
  unanswered,
  onConfirmAll,
}: {
  confirmed: number;
  proposals: number;
  unanswered: number;
  onConfirmAll: () => void;
}) {
  const t = useTranslations("registration");
  if (proposals === 0 && unanswered === 0 && confirmed === 0) return null;

  return (
    <div className="p-reg__proposal-summary" data-testid="proposal-summary">
      <div className="p-reg__proposal-summary-counts">
        <span>{t("summaryConfirmed", { count: confirmed })}</span>
        <span className={proposals > 0 ? "p-reg__proposal-summary-open" : undefined}>
          {t("summaryProposals", { count: proposals })}
        </span>
        <span>{t("summaryUnanswered", { count: unanswered })}</span>
      </div>
      <p className="p-reg__proposal-summary-note">{t("summaryNote")}</p>
      {proposals > 0 ? (
        <button
          type="button"
          className="p-reg__proposal-summary-btn"
          data-testid="confirm-all-suggestions"
          onClick={onConfirmAll}
        >
          {t("confirmAll")}
        </button>
      ) : null}
    </div>
  );
}
