"use client";

import { useTranslations } from "next-intl";
import type { DeviceInstanceDTO } from "@/interfaces";
import {
  deviceDisplayName,
  deviceInspectionTags,
  deviceLocationLine,
  type useCapturerInventory,
} from "@/components/hooks/scan/useCapturerInventory";
import { BarcodeCapture } from "@/components/features/shared/barcode-capture";
import { OpenButton } from "@/components/features/shared/OpenButton";
import { identifierLookupText } from "@/lib/barcode/matchDevice";

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
  const {
    devices,
    loading,
    keywordInput,
    setKeyword,
    room,
    setRoom,
    rooms,
    openDevice,
    detailLoading,
  } = inventory;

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

      <div className="p-bestand__filters">
        <div className="p-bestand__search" data-testid="capturer-inventory-search">
          <BarcodeCapture
            data-testid="capturer-inventory-scan"
            placeholder={t("searchPlaceholder")}
            submitLabel={tCommon("search")}
            showKindHint={false}
            onCapture={(result) => {
              setKeyword(identifierLookupText(result.identifier) || result.raw);
            }}
          />
          {/* Keep typed filter in sync when user is mid-search from a prior scan */}
          {keywordInput ? (
            <p className="p-bestand__sub mt-1 text-xs" data-testid="capturer-inventory-active-q">
              {keywordInput}
            </p>
          ) : null}
        </div>
        <div className="p-bestand__room">
          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            aria-label={t("roomFilterAria")}
            data-testid="capturer-inventory-room"
          >
            <option value="">{t("allRooms")}</option>
            {room && !rooms.includes(room) && (
              <option value={room}>{t("roomOption", { room })}</option>
            )}
            {rooms.map((r) => (
              <option key={r} value={r}>
                {t("roomOption", { room: r })}
              </option>
            ))}
          </select>
        </div>
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
}: {
  device: DeviceInstanceDTO;
  busy: boolean;
  onOpen: () => void;
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
      <OpenButton
        onClick={onOpen}
        disabled={busy}
        data-testid="capturer-inventory-open"
        className="shrink-0"
      />
    </li>
  );
}
