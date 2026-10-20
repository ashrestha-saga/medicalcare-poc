"use client";

import { useTranslations } from "next-intl";
import { useChargenList } from "@/components/hooks/scan/useChargenList";

export function ChargenScreen({
  active,
  onOpenBatch,
  onNewCharge,
}: {
  active: boolean;
  onOpenBatch: (batchId: string, deviceId: string) => void;
  onNewCharge?: () => void;
}) {
  const t = useTranslations("scan.chargen");
  const { items, loading, reload } = useChargenList(active);

  return (
    <section className="p-heute" data-testid="chargen-screen">
      <header className="p-heute__head">
        <div>
          <h2>{t("title")}</h2>
          <p className="p-heute__sub">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          className="p-heute__refresh"
          onClick={() => void reload()}
          disabled={loading}
        >
          {t("refresh")}
        </button>
      </header>

      {loading && items.length === 0 ? (
        <p className="p-heute__empty">{t("loading")}</p>
      ) : null}
      {!loading && items.length === 0 ? (
        <div className="p-charge__empty">
          <p className="p-heute__empty">{t("empty")}</p>
          {onNewCharge ? (
            <button type="button" className="p-routine__save" onClick={onNewCharge}>
              {t("newViaScan")}
            </button>
          ) : null}
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="p-heute__list">
          {items.map((b) => (
            <li key={b.id} className="p-heute__row" data-band="open">
              <button
                type="button"
                className="p-heute__row-btn"
                onClick={() => onOpenBatch(b.id, b.equipmentDeviceId)}
                data-testid={`chargen-row-${b.id}`}
              >
                <div className="p-heute__row-main">
                  <span className="p-heute__inv mono">{b.batchNumber}</span>
                  <span className="p-heute__label">{b.label}</span>
                  <span className="p-heute__place">
                    {b.programme ?? "—"} · {b.inventoryNumber}
                    {!b.hasBeleg ? ` · ${t("noBeleg")}` : ""}
                  </span>
                </div>
                <div className="p-heute__row-meta">
                  <span className="p-heute__chip" data-band="open">
                    {t("open")}
                  </span>
                  <span className="arr" aria-hidden>
                    ›
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
