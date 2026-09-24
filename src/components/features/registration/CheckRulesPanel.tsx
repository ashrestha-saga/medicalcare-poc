"use client";

import { useLocale, useTranslations } from "next-intl";
import type { CheckRuleHit, RegistrationCharacteristics } from "@/interfaces";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";

export function CheckRulesPanel({
  hits,
  merkmale,
  onAcknowledge,
}: {
  hits: CheckRuleHit[];
  merkmale: RegistrationCharacteristics;
  onAcknowledge: (hit: CheckRuleHit) => void;
}) {
  const t = useTranslations("registration");
  const locale = useLocale() as AppLocale;

  if (!hits.length) return null;

  const fieldShort = (f: string) => (t.has(`fieldShort.${f}`) ? t(`fieldShort.${f}`) : f);

  return (
    <div className="p-reg__pruef" data-testid="check-rules-panel">
      <h4 className="p-reg__pruef-title">{t("checkRulesTitle")}</h4>
      <ul className="p-reg__pruef-list">
        {hits.map((hit) => {
          const q = merkmale.ruleQuittances?.[hit.id];
          const open = hit.level === "widerspruch" || !q;
          return (
            <li
              key={hit.id}
              className="p-reg__pruef-item"
              data-stufe={hit.level}
              data-open={open ? "1" : "0"}
              data-testid={`check-rule-${hit.id}`}
            >
              <b>{hit.level === "widerspruch" ? t("contradiction") : t("note")}</b>
              <span>{hit.message}</span>
              <em>
                {t("affects")} {hit.fieldIds.map((f) => fieldShort(f)).join(", ")}
              </em>
              {hit.level === "hinweis" ? (
                q ? (
                  <em className="p-reg__pruef-q">
                    {t("acknowledged", { by: q.by, at: formatDateTime(q.at, locale) })}
                  </em>
                ) : (
                  <button
                    type="button"
                    className="p-reg__pruef-ack"
                    onClick={() => onAcknowledge(hit)}
                  >
                    {t("acknowledge")}
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Inline rules under a specific question (FA-222). */
export function FieldCheckRules({
  field,
  hits,
  merkmale,
  onAcknowledge,
}: {
  field: string;
  hits: CheckRuleHit[];
  merkmale: RegistrationCharacteristics;
  onAcknowledge: (hit: CheckRuleHit) => void;
}) {
  const t = useTranslations("registration");
  const local = hits.filter((h) => h.fieldIds.includes(field));
  if (!local.length) return null;
  return (
    <div className="p-reg__pruef-inline" data-testid={`field-rules-${field}`}>
      {local.map((hit) => {
        const q = merkmale.ruleQuittances?.[hit.id];
        return (
          <div key={hit.id} className="p-reg__pruef-inline-item" data-stufe={hit.level}>
            <strong>{hit.level === "widerspruch" ? t("contradiction") : t("note")}</strong>
            <span>{hit.message}</span>
            {hit.level === "hinweis" && !q ? (
              <button type="button" className="p-reg__pruef-ack" onClick={() => onAcknowledge(hit)}>
                {t("acknowledge")}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
