"use client";

import { useTranslations } from "next-intl";
import type { DeviceInstanceDTO } from "@/interfaces";
import {
  deviceDisplayName,
  deviceInspectionTags,
  deviceLocationLine,
  type useCapturerInventory,
} from "@/components/hooks/scan/useCapturerInventory";

type InventoryApi = ReturnType<typeof useCapturerInventory>;

export function CapturerInventoryList({
  inventory,
  onClose,
}: {
  inventory: InventoryApi;
  onClose?: () => void;
}) {
  const t = useTranslations("capturer");
  const tCommon = useTranslations("common");
  const { devices, loading, keywordInput, setKeyword, openDevice, detailLoading } = inventory;

  return (
    <div className="p-bestand" data-testid="capturer-inventory">
      <header className="p-bestand__head">
        <div>
          <h2>{t("inventoryTitle")}</h2>
          <p className="p-bestand__sub">{t("inventoryLegal")}</p>
        </div>
        <div className="p-bestand__head-actions">
          <span className="p-bestand__count" data-testid="capturer-inventory-count">
            {t("deviceCount", { count: devices.length })}
          </span>
          {onClose && (
            <button
              type="button"
              className="p-bestand-detail__close"
              onClick={onClose}
              aria-label={tCommon("close")}
              data-testid="capturer-inventory-close"
            >
              ×
            </button>
          )}
        </div>
      </header>

      <div className="p-bestand__search">
        <input
          type="search"
          value={keywordInput}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t("searchPlaceholder")}
          data-testid="capturer-inventory-search"
          aria-label={t("searchAria")}
        />
      </div>

      {loading ? (
        <p className="p-bestand__empty">{t("loading")}</p>
      ) : devices.length === 0 ? (
        <p className="p-bestand__empty">{t("empty")}</p>
      ) : (
        <ul className="p-bestand__list">
          {devices.map((device) => (
            <InventoryRow
              key={device.id}
              device={device}
              busy={detailLoading}
              onOpen={() => void openDevice(device)}
              openLabel={t("open")}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function InventoryRow({
  device,
  busy,
  onOpen,
  openLabel,
}: {
  device: DeviceInstanceDTO;
  busy: boolean;
  onOpen: () => void;
  openLabel: string;
}) {
  const tags = deviceInspectionTags(device);
  return (
    <li className="p-bestand__row">
      <div className="p-bestand__row-main">
        <div className="p-bestand__title">{deviceDisplayName(device)}</div>
        <div className="p-bestand__meta">{deviceLocationLine(device)}</div>
        {tags.length > 0 && (
          <div className="p-bestand__tags">
            {tags.map((tag) => (
              <span
                key={tag}
                className="p-bestand__tag"
                data-tag={tag.toLowerCase().replace(/\s+/g, "-")}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        className="p-bestand__open"
        onClick={onOpen}
        disabled={busy}
        data-testid="capturer-inventory-open"
      >
        {openLabel}
      </button>
    </li>
  );
}
