"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ScanHeuteItemDTO, ScanHeuteSiteItemDTO } from "@/interfaces";
import { useHeuteList } from "@/components/hooks/scan/useHeuteList";

type HeuteSubTab = "devices" | "sites";

function HeuteDeviceRow({
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
          {item.openDguvOwnCheck ? (
            <span className="p-heute__chip p-heute__chip--warn">{t("openDguv")}</span>
          ) : null}
        </div>
      </button>
    </li>
  );
}

function HeuteSiteRow({
  item,
  onOpen,
}: {
  item: ScanHeuteSiteItemDTO;
  onOpen: (siteId: string) => void;
}) {
  const t = useTranslations("scan.heute");

  return (
    <li
      className="p-heute__row"
      data-band={item.band}
      data-testid={`heute-site-${item.siteId}`}
    >
      <button type="button" className="p-heute__row-btn" onClick={() => onOpen(item.siteId)}>
        <div className="p-heute__row-main">
          <strong className="p-heute__inv">{item.siteName}</strong>
          <span className="p-heute__label">{t("siteKind")}</span>
          <span className="p-heute__place">{t("siteHint")}</span>
        </div>
        <div className="p-heute__row-meta">
          <span className="p-heute__chip" data-band={item.band}>
            {t(`band.${item.band}`)}
          </span>
          {item.openDailyChecks ? (
            <span className="p-heute__chip p-heute__chip--warn">
              {t("siteOpenCount", { count: item.openCount })}
            </span>
          ) : (
            <span className="p-heute__chip">{t("siteDailyDone")}</span>
          )}
        </div>
      </button>
    </li>
  );
}

export function HeuteScreen({
  active,
  onOpenDevice,
  onOpenSite,
}: {
  active: boolean;
  onOpenDevice: (deviceId: string) => void;
  onOpenSite?: (siteId: string) => void;
}) {
  const t = useTranslations("scan.heute");
  const { data, loading, reload } = useHeuteList(active);
  const [subTab, setSubTab] = useState<HeuteSubTab>("devices");

  if (!active) return null;

  const devices = data?.items ?? [];
  const sites = data?.sites ?? [];
  const deviceOpen = devices.filter((d) => d.band !== "done").length;
  const siteOpen = sites.filter((s) => s.openDailyChecks).length;

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

      <div className="p-heute__tabs" role="tablist" aria-label={t("tabsAria")} data-testid="heute-subtabs">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === "devices"}
          className="p-heute__tab"
          data-active={subTab === "devices" ? "1" : "0"}
          data-testid="heute-tab-devices"
          onClick={() => setSubTab("devices")}
        >
          {t("tabDevices")}
          {deviceOpen > 0 ? <span className="p-heute__tab-badge">{deviceOpen}</span> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === "sites"}
          className="p-heute__tab"
          data-active={subTab === "sites" ? "1" : "0"}
          data-testid="heute-tab-sites"
          onClick={() => setSubTab("sites")}
        >
          {t("tabSites")}
          {siteOpen > 0 ? <span className="p-heute__tab-badge">{siteOpen}</span> : null}
        </button>
      </div>

      {loading && !data ? (
        <p className="p-heute__empty">{t("loading")}</p>
      ) : subTab === "devices" ? (
        devices.length === 0 ? (
          <p className="p-heute__empty">
            {data && !data.unscoped && (data.areaIds?.length ?? 0) === 0
              ? t("noAreas")
              : t("emptyDevices")}
          </p>
        ) : (
          <ul className="p-heute__list">
            {devices.map((item) => (
              <HeuteDeviceRow key={item.deviceId} item={item} onOpen={onOpenDevice} />
            ))}
          </ul>
        )
      ) : sites.length === 0 ? (
        <p className="p-heute__empty">{t("emptySites")}</p>
      ) : (
        <ul className="p-heute__list">
          {sites.map((item) => (
            <HeuteSiteRow
              key={item.siteId}
              item={item}
              onOpen={(id) => onOpenSite?.(id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
