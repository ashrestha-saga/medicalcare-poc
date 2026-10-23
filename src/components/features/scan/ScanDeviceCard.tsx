"use client";

import { useTranslations } from "next-intl";
import type { ScanActionCtx, ScanDeviceCardDTO } from "@/interfaces";
import { useScanDeviceCard } from "@/components/hooks/scan/useScanDeviceCard";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import type { ScanChargeListItemDTO } from "@/interfaces";

export function ScanDeviceCard({
  deviceId,
  canStoerung,
  canRoutine,
  canCharge,
  onBack,
  onStoerung,
  onRoutine,
  onKonstanz,
  onChargeNeu,
  onChargeFreigabe,
  onService,
  onParts,
}: {
  deviceId: string;
  canStoerung: boolean;
  canRoutine: boolean;
  canCharge: boolean;
  onBack: () => void;
  onStoerung: (card: ScanDeviceCardDTO) => void;
  onRoutine: (card: ScanDeviceCardDTO) => void;
  onKonstanz: (card: ScanDeviceCardDTO) => void;
  onChargeNeu: (card: ScanDeviceCardDTO) => void;
  onChargeFreigabe: (card: ScanDeviceCardDTO, batchId: string) => void;
  onService: (card: ScanDeviceCardDTO) => void;
  onParts: (card: ScanDeviceCardDTO) => void;
}) {
  const t = useTranslations("scan.device");
  const { card, loading } = useScanDeviceCard(deviceId);

  if (loading && !card) {
    return (
      <section className="p-scan-device" data-testid="scan-device-card">
        <p className="p-heute__empty">{t("loading")}</p>
      </section>
    );
  }
  if (!card) {
    return (
      <section className="p-scan-device" data-testid="scan-device-card">
        <button type="button" className="p-close" onClick={onBack} aria-label={t("back")}>
          ×
        </button>
        <p className="p-heute__empty">{t("missing")}</p>
      </section>
    );
  }

  const place = [card.siteName, card.areaName, card.room].filter(Boolean).join(" · ");

  const openCharge = async (preferredBatchId?: string) => {
    if (!canCharge) {
      toast.error(t("chargeDenied"));
      return;
    }
    if (preferredBatchId) {
      onChargeFreigabe(card, preferredBatchId);
      return;
    }
    try {
      const res = await api<{ items: ScanChargeListItemDTO[] }>(
        `/api/scan/chargen?equipmentDeviceId=${encodeURIComponent(card.deviceId)}`,
      );
      const first = res.items[0];
      if (first) {
        onChargeFreigabe(card, first.id);
        return;
      }
      onChargeNeu(card);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("chargeDenied"));
    }
  };

  const runAction = (ctx: ScanActionCtx, infoOnly?: boolean, batchId?: string, ref?: string) => {
    if (infoOnly) {
      toast.info(card.sperrGrund ?? t("noticeOnly"));
      return;
    }
    switch (ctx) {
      case "stoerung":
        if (!canStoerung) {
          toast.error(t("stoerungDenied"));
          return;
        }
        onStoerung(card);
        return;
      case "routine":
        if (!canRoutine) {
          toast.error(t("routineDenied"));
          return;
        }
        onRoutine(card);
        return;
      case "service":
      case "anfragen":
        onService(card);
        return;
      case "ersatz":
        onParts(card);
        return;
      case "charge-neu":
        if (!canCharge) {
          toast.error(t("chargeDenied"));
          return;
        }
        onChargeNeu(card);
        return;
      case "charge":
        void openCharge(batchId);
        return;
      case "konstanz":
        onKonstanz(card);
        return;
      case "ifu":
        if (card.ifuOpenUrl) {
          window.open(card.ifuOpenUrl, "_blank", "noopener,noreferrer");
          return;
        }
        toast.info(ref ? t("ifuOpen", { ref }) : t("ifuMissingToast"));
        return;
      default:
        return;
    }
  };

  const i18nRef = (a: { ref?: string }) => a.ref ?? card.openRequestRef ?? card.ifuLabel ?? "—";

  return (
    <section className="p-scan-device" data-testid="scan-device-card" data-lage={card.sperrLage}>
      <header className="p-scan-device__head">
        <button type="button" className="p-close" onClick={onBack} aria-label={t("back")}>
          ×
        </button>
        <h2>{card.label}</h2>
        <div className="p-scan-device__meta">
          <span className="mono">{card.inventoryNumber}</span>
          {card.serialNumber ? <span className="mono">{card.serialNumber}</span> : null}
          {card.manufacturer ? <span>{card.manufacturer}</span> : null}
        </div>
      </header>

      <div className="p-scan-device__lage" data-t={card.sperrLage}>
        <b>{t(`lage.${card.sperrLage}`)}</b>
        <small>{card.sperrGrund ?? t("lageOkHint")}</small>
      </div>

      {place ? (
        <div className="p-scan-device__ort">
          <span className="k">{t("location")}</span>
          <span>{place}</span>
        </div>
      ) : null}

      <button
        type="button"
        className="p-scan-device__prim"
        data-t={card.primary.tone}
        data-testid="scan-primary-action"
        onClick={() => runAction(card.primary.ctx, card.primary.infoOnly, card.primary.batchId)}
      >
        <span className="k">{t("now")}</span>
        <b>{t(card.primary.titleKey, { ref: card.openRequestRef ?? "—" })}</b>
        <small>{t(card.primary.textKey, { ref: card.openRequestRef ?? "—" })}</small>
      </button>

      <h3 className="p-scan-device__h2">{t("further")}</h3>
      <ul className="p-scan-device__rows">
        {card.further.map((a) => (
          <li key={`${a.ctx}-${a.titleKey}`}>
            <button
              type="button"
              className="p-scan-device__rowbtn"
              onClick={() => runAction(a.ctx, undefined, a.batchId, a.ref)}
            >
              <div className="g">
                <b>{t(a.titleKey, { ref: i18nRef(a) })}</b>
                <small>{t(a.textKey, { ref: i18nRef(a) })}</small>
              </div>
              <span className="arr" aria-hidden>
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
