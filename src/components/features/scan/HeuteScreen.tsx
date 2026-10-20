"use client";

import { useTranslations } from "next-intl";
import type { ScanHeuteItemDTO } from "@/interfaces";
import { useHeuteList } from "@/components/hooks/scan/useHeuteList";

function HeuteRow({
  item,
  onOpen,
}: {
  item: ScanHeuteItemDTO;
  onOpen: (deviceId: string) => void;
}) {
  const t = useTranslations("scan.heute");
  const place = [item.siteName, item.areaName, item.room].filter(Boolean).join(" · ");

  return (
    <li className="p-heute__row" data-band={item.band} data-testid={`heute-row-${item.deviceId}`}>
      <button type="button" className="p-heute__row-btn" onClick={() => onOpen(item.deviceId)}>
        <div className="p-heute__row-main">
          <strong className="p-heute__inv">{item.inventoryNumber}</strong>
          <span className="p-heute__label">{item.label}</span>
          {place ? <span className="p-heute__place">{place}</span> : null}
        </div>
        <div className="p-heute__row-meta">
          <span className="p-heute__chip" data-band={item.band}>
            {t(`band.${item.band}`)}
          </span>
          {item.openDailyChecks ? (
            <span className="p-heute__chip p-heute__chip--warn">{t("openDaily")}</span>
          ) : null}
          {item.band === "done" && !item.openDailyChecks ? (
            <span className="p-heute__chip">{t("dailyDone")}</span>
          ) : null}
          {item.openBatchCount > 0 ? (
            <span className="p-heute__chip p-heute__chip--warn">
              {t("openBatches", { count: item.openBatchCount })}
            </span>
          ) : null}
          {item.openKonstanzChecks ? (
            <span className="p-heute__chip p-heute__chip--warn">{t("openKonstanz")}</span>
          ) : null}
        </div>
      </button>
    </li>
  );
}

export function HeuteScreen({
  active,
  onOpenDevice,
}: {
  active: boolean;
  onOpenDevice: (deviceId: string) => void;
}) {
  const t = useTranslations("scan.heute");
  const { data, loading, reload } = useHeuteList(active);

  if (!active) return null;

  return (
    <section className="p-heute" data-testid="heute-screen">
      <header className="p-heute__head">
        <div>
          <h2>{t("title")}</h2>
          <p className="p-heute__sub">{t("subtitle")}</p>
        </div>
        <button type="button" className="p-heute__refresh" onClick={() => void reload()} disabled={loading}>
          {t("refresh")}
        </button>
      </header>

      {loading && !data ? (
        <p className="p-heute__empty">{t("loading")}</p>
      ) : !data || data.items.length === 0 ? (
        <p className="p-heute__empty">
          {data && !data.unscoped && (data.areaIds?.length ?? 0) === 0 ? t("noAreas") : t("empty")}
        </p>
      ) : (
        <ul className="p-heute__list">
          {data.items.map((item) => (
            <HeuteRow key={item.deviceId} item={item} onOpen={onOpenDevice} />
          ))}
        </ul>
      )}
    </section>
  );
}
