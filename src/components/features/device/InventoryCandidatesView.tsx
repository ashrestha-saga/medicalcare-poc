"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DeviceInstanceDTO, InventoryCandidatesViewProps } from "@/interfaces";
import { deviceDisplayName, deviceLocationLine } from "@/components/hooks/scan/useCapturerInventory";

/** GTIN matched several inventory exemplars — pick one or continue without selection. */
export function InventoryCandidatesView({
  resolution,
  onSelect,
  onSkip,
  onClose,
  selecting = false,
  selectError = null,
}: InventoryCandidatesViewProps) {
  const t = useTranslations("device");
  const candidates = resolution.candidates ?? [];
  const [pickedId, setPickedId] = useState<string | null>(null);
  const gtin = resolution.identifier.udiDi ?? resolution.identifier.gtin ?? resolution.identifier.raw;

  return (
    <div className="p-inv-cand" data-testid="inventory-candidates-view">
      <header className="p-inv-cand__head">
        <div>
          <h2>{t("candidatesTitle")}</h2>
          <p className="p-inv-cand__sub">
            {t("candidatesSubtitle", { gtin, count: candidates.length })}
          </p>
        </div>
        <button type="button" className="p-close" onClick={onClose} aria-label={t("scanAnotherAria")}>
          ×
        </button>
      </header>

      {selectError ? (
        <p className="p-inv-cand__err" data-testid="inventory-candidates-error" role="alert">
          {selectError}
        </p>
      ) : null}

      <ul className="p-inv-cand__list" data-testid="inventory-candidates-list">
        {candidates.map((device) => (
          <CandidateRow
            key={device.id}
            device={device}
            selected={pickedId === device.id}
            disabled={selecting}
            onPick={() => setPickedId(device.id)}
          />
        ))}
      </ul>

      <div className="p-inv-cand__actions">
        <button
          type="button"
          className="p-big"
          data-p="1"
          disabled={!pickedId || selecting}
          onClick={() => pickedId && onSelect(pickedId)}
          data-testid="inventory-candidates-continue"
        >
          <b>{selecting ? t("candidatesSelecting") : t("candidatesContinue")}</b>
          <span>{t("candidatesContinueHint")}</span>
        </button>
        <button
          type="button"
          className="p-big"
          disabled={selecting}
          onClick={onSkip}
          data-testid="inventory-candidates-skip"
        >
          <b>{t("candidatesSkip")}</b>
          <span>{t("candidatesSkipHint")}</span>
        </button>
      </div>
    </div>
  );
}

function CandidateRow({
  device,
  selected,
  disabled,
  onPick,
}: {
  device: DeviceInstanceDTO;
  selected: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const t = useTranslations("device");
  return (
    <li>
      <button
        type="button"
        className="p-inv-cand__row"
        data-selected={selected ? "1" : "0"}
        data-testid="inventory-candidate-row"
        disabled={disabled}
        onClick={onPick}
        aria-pressed={selected}
      >
        <span className="p-inv-cand__radio" aria-hidden>
          {selected ? "●" : "○"}
        </span>
        <span className="p-inv-cand__main">
          <span className="p-inv-cand__title">{deviceDisplayName(device)}</span>
          <span className="p-inv-cand__meta">{deviceLocationLine(device)}</span>
          {device.serialNumber ? (
            <span className="p-inv-cand__sn mono">
              {t("candidatesSerial", { serial: device.serialNumber })}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
