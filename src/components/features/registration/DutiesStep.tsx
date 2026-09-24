"use client";

import { useLocale, useTranslations } from "next-intl";
import type { DerivedDuty } from "@/interfaces";
import type { DecisionProtocolEntry } from "@/interfaces";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";

const BEZUG_KEYS: Record<string, "bezugMonatsende" | "bezugJahresende" | "bezugTag" | "bezugEreignis" | "bezugIntervall" | "bezugProzess" | "bezugDauerhaft"> = {
  monatsende: "bezugMonatsende",
  jahresende: "bezugJahresende",
  tag: "bezugTag",
  ereignis: "bezugEreignis",
  intervall: "bezugIntervall",
  prozess: "bezugProzess",
  dauerhaft: "bezugDauerhaft",
};

const ORIGIN_KEYS: Record<DecisionProtocolEntry["origin"], "originConfirmed" | "originChanged" | "originSelf"> = {
  bestaetigt: "originConfirmed",
  geaendert: "originChanged",
  selbst_gewaehlt: "originSelf",
};

function einheitLabel(
  einheit: string | undefined,
  t: (key: "months" | "years") => string,
): string {
  if (!einheit) return "";
  const lower = einheit.toLowerCase();
  if (lower === "monate" || lower === "months" || lower === "month" || lower === "monat") {
    return t("months");
  }
  if (lower === "jahre" || lower === "years" || lower === "year" || lower === "jahr") {
    return t("years");
  }
  return einheit;
}

export function DutiesStep({
  duties,
  decisionProtocol = [],
  onBack,
  onContinue,
}: {
  duties: DerivedDuty[];
  decisionProtocol?: DecisionProtocolEntry[];
  onBack: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations("registration");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;

  const bezugLabel = (bezug: string) => {
    const key = BEZUG_KEYS[bezug];
    return key ? t(key) : bezug;
  };

  return (
    <section className="p-reg__step-body" data-testid="registration-step-duties">
      <div className="p-reg__card space-y-3">
        <h3 className="p-reg__section">{t("dutiesTitle")}</h3>
        {duties.map((d) => (
          <div
            key={d.id}
            className={`rounded-md border border-[var(--border)] bg-[var(--navy)]/40 p-3 ${d.einschlaegig ? "" : "opacity-50"}`}
            data-applicable={d.einschlaegig ? "1" : "0"}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{d.titel}</span>
              <Badge variant="secondary">{d.art}</Badge>
              {d.vertrauen !== "n/a" ? (
                <Badge variant="outline">
                  {d.vertrauen === "verified" ? t("verified") : t("derived")}
                </Badge>
              ) : null}
            </div>
            <div className="mt-2 grid gap-1 text-xs text-[var(--on-dark-soft)] sm:grid-cols-2">
              <div>
                {t("basis")}: <span className="text-[var(--on-dark)]">{d.grund}</span>
              </div>
              <div>
                {t("deadline")}:{" "}
                <span className="text-[var(--on-dark)]">
                  {d.frist != null
                    ? `${d.frist} ${einheitLabel(d.einheit ?? undefined, t)}`
                    : d.intervall ?? tCommon("dash")}{" "}
                  · {bezugLabel(d.bezug)}
                </span>
              </div>
              <div>
                {t("evidence")}: <span className="text-[var(--on-dark)]">{d.nachweis}</span>
              </div>
              <div>
                {t("responsibleDuty")}: <span className="text-[var(--on-dark)]">{d.zustaendig}</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-[var(--on-dark-soft)]">{d.hinweis}</p>
            {d.routine && d.routine.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-[var(--on-dark-soft)]">
                {d.routine.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
            {d.freigabe ? (
              <p className="mt-1 text-xs text-[var(--on-dark-soft)]">
                {t("releaseRule", { rule: d.freigabe })}
              </p>
            ) : null}
          </div>
        ))}

        {decisionProtocol.length > 0 ? (
          <div className="p-reg__protocol" data-testid="decision-protocol">
            <h4 className="p-reg__section p-reg__section--tight">{t("protocolTitle")}</h4>
            <p className="mb-2 text-xs text-[var(--on-dark-soft)]">{t("protocolLead")}</p>
            <div className="overflow-x-auto">
              <table className="p-reg__protocol-table">
                <thead>
                  <tr>
                    <th>{t("field")}</th>
                    <th>{t("answer")}</th>
                    <th>{t("origin")}</th>
                    <th>{t("person")}</th>
                    <th>{t("time")}</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionProtocol.map((e) => (
                    <tr key={e.field}>
                      <td>{e.label}</td>
                      <td>{e.answer}</td>
                      <td>{t(ORIGIN_KEYS[e.origin])}</td>
                      <td>{e.person ?? tCommon("dash")}</td>
                      <td className="t-mono">
                        {e.at ? formatDateTime(e.at, locale) : tCommon("dash")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <Alert>{t("dutiesAlert")}</Alert>
        <div className="p-reg__actions">
          <button type="button" className="p-cta ghost" onClick={onBack}>
            {t("back")}
          </button>
          <button type="button" className="p-cta" onClick={onContinue}>
            {t("reviewPrereqs")}
          </button>
        </div>
      </div>
    </section>
  );
}
