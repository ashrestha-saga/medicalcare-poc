"use client";

import { useTranslations } from "next-intl";

export function ScanConfirmScreen({
  title,
  lines,
  hint,
  onDevice,
  onHeute,
}: {
  title: string;
  lines: { label: string; value: string }[];
  hint?: string | null;
  onDevice: () => void;
  onHeute: () => void;
}) {
  const t = useTranslations("scan.confirm");

  return (
    <section className="p-scan-confirm" data-testid="scan-confirm">
      <h2>{title}</h2>
      <dl className="p-scan-confirm__lines">
        {lines.map((l) => (
          <div key={l.label} className="p-scan-confirm__row">
            <dt>{l.label}</dt>
            <dd>{l.value}</dd>
          </div>
        ))}
      </dl>
      {hint ? <p className="p-scan-confirm__hint">{hint}</p> : null}
      <div className="p-scan-confirm__actions">
        <button type="button" className="p-scan-confirm__primary" onClick={onDevice}>
          {t("toDevice")}
        </button>
        <button type="button" className="p-scan-confirm__secondary" onClick={onHeute}>
          {t("toHeute")}
        </button>
      </div>
    </section>
  );
}
