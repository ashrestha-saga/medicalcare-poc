"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type {
  BeudamedExternalViewProps,
  CatalogActionViewProps,
  CatalogModelViewProps,
  InventoryDeviceViewProps,
} from "@/interfaces";
import { useCatalogAdopt } from "@/components/hooks/device/useCatalogAdopt";
import { useRequestStore } from "@/store/requestStore";
import { inspectionTagsFromFlags } from "@/lib/inspectionTags";
import { intlLocale, type AppLocale } from "@/lib/locale";
import { DeviceHeader } from "./DeviceHeader";
import { InventoryLocationCheck } from "./InventoryLocationCheck";

function formatFetchedAt(iso: string, locale: AppLocale): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(intlLocale(locale), { day: "numeric", month: "numeric", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Stage 2 adopt — inventory miss, article master (local or OXID) knows the model. */
function CatalogModelView({ resolution, onAdopt, onClose }: CatalogModelViewProps) {
  const t = useTranslations("device");
  const model = resolution.model;
  const title = model?.tradeName ?? model?.modelName ?? t("articleFallback");
  const code = model?.udiDi ?? model?.gtins?.[0] ?? resolution.identifier.udiDi ?? resolution.identifier.gtin ?? null;
  const isOxid = resolution.source.system === "oxid-catalog";

  return (
    <div className="p-adopt" data-adopt="catalog" data-testid="catalog-model-view">
      <section className="p-devhead p-adopt__head">
        <button type="button" className="p-close" onClick={onClose} aria-label={t("scanAnotherAria")}>
          ×
        </button>
        <h2 data-testid="device-title">{title}</h2>
        {(code || model?.manufacturer) && (
          <div className="codes">
            {code && <span>{code}</span>}
            {model?.manufacturer && <span>{model.manufacturer}</span>}
          </div>
        )}
        <p className="p-adopt__status">
          {t("articleFromMaster")}
          {isOxid ? t("oxidShopSuffix") : ""}
        </p>
      </section>

      <div className="p-adopt__body">
        <div
          className="p-src p-adopt__src"
          data-s="catalog"
          data-testid="source-banner"
          data-source={resolution.source.system}
        >
          {isOxid ? t("sourceOxidCatalog") : t("sourceLocalCatalog")}
        </div>

        <div className="p-lead p-adopt__lead" data-s="catalog" data-testid="catalog-lead">
          {t("catalogLead")}
        </div>

        <p className="p-ext-note p-adopt__note">{t("udiDiNote")}</p>

        <button type="button" className="p-cta p-adopt__cta" onClick={onAdopt} data-testid="adopt-catalog">
          {t("continueForService")}
        </button>
      </div>
    </div>
  );
}

/** After catalog adopt — choose service request or spare parts. */
function CatalogActionView({ resolution, onService, onParts, onBack, onClose }: CatalogActionViewProps) {
  const t = useTranslations("device");
  return (
    <div data-testid="catalog-action-view">
      <DeviceHeader
        resolution={resolution}
        captured={null}
        actions={
          <>
            <button type="button" className="p-close" onClick={onBack} aria-label={t("backAria")} data-testid="catalog-action-back">
              ←
            </button>
            <button type="button" className="p-close" onClick={onClose} aria-label={t("scanAnotherAria")}>
              ×
            </button>
          </>
        }
      />

      <div className="p-two">
        <button type="button" className="p-big" data-p="1" onClick={onService} data-testid="continue-service-request">
          <b>{t("serviceRequest")}</b>
          <span>{t("serviceRequestHintProduct")}</span>
        </button>
        <button type="button" className="p-big" onClick={onParts} data-testid="open-parts">
          <b>{t("spareParts")}</b>
          <span>{t("sparePartsHint")}</span>
        </button>
      </div>
    </div>
  );
}

/** EXTERNAL DATA — shown first when stage 3 (BEUDAMED / EUDAMED) answers. */
function BeudamedExternalView({ resolution, onAdopt, onClose }: BeudamedExternalViewProps) {
  const t = useTranslations("device");
  const locale = useLocale() as AppLocale;
  const model = resolution.model;
  const title = model?.tradeName ?? model?.modelName ?? t("deviceFallback");
  const udi = model?.udiDi ?? resolution.identifier.udiDi ?? resolution.identifier.gtin ?? null;
  const fetched = formatFetchedAt(resolution.source.fetchedAt, locale);

  const rows: { label: string; value: string }[] = [
    model?.manufacturer ? { label: t("fieldManufacturer"), value: model.manufacturer } : null,
    model?.riskClass ? { label: t("fieldRiskClass"), value: model.riskClass } : null,
    model?.emdnCode ? { label: t("fieldEmdn"), value: model.emdnCode } : null,
    model?.basicUdiDi ? { label: t("fieldBasicUdiDi"), value: model.basicUdiDi } : null,
    model?.gmdnCode ? { label: t("fieldGmdn"), value: model.gmdnCode } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="p-adopt" data-testid="beudamed-external-view">
      <section className="p-devhead p-adopt__head">
        <button type="button" className="p-close" onClick={onClose} aria-label={t("scanAnotherAria")}>
          ×
        </button>
        <h2 data-testid="device-title">{title}</h2>
        {(udi || model?.manufacturer) && (
          <div className="codes">
            {udi && <span>{udi}</span>}
            {model?.manufacturer && <span>{model.manufacturer}</span>}
          </div>
        )}
        <p className="p-adopt__status">{t("externalManufacturerData")}</p>
      </section>

      <div className="p-adopt__body">
        <div
          className="p-src p-adopt__src"
          data-s="beudamed"
          data-testid="source-banner"
          data-source="beudamed"
        >
          {t("beudamedBanner")}
          {resolution.source.cached ? t("cacheSuffix") : ""}
          {t("fetchedPrefix", { date: fetched })}
        </div>

        <div className="p-lead p-adopt__lead" data-s="catalog" data-testid="beudamed-lead">
          {t("beudamedLead")}
        </div>

        {rows.length > 0 && (
          <dl className="p-ext-dl p-adopt__fields" data-testid="beudamed-fields">
            {rows.map((r) => (
              <div key={r.label} className="p-ext-row">
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="p-ext-note p-adopt__note">{t("udiDiNoteNoRecord")}</p>

        <button type="button" className="p-cta p-adopt__cta" onClick={onAdopt} data-testid="continue-service-request">
          {t("continueForService")}
        </button>
      </div>
    </div>
  );
}

/** Stage 1 — device already in inventory: confirm place of use, then service / parts. */
function InventoryDeviceView({ resolution, onService, onParts, onClose }: InventoryDeviceViewProps) {
  const t = useTranslations("device");
  const device = resolution.device!;
  const siteId = useRequestStore((s) => s.form.siteId);
  const [locError, setLocError] = useState<string | null>(null);

  const inv = device.inventoryNumber;
  const tags = inspectionTagsFromFlags(device.classification ?? null);

  const goService = () => {
    if (!siteId.trim()) {
      setLocError(t("selectSiteError"));
      return;
    }
    setLocError(null);
    onService();
  };

  const goParts = () => {
    if (!siteId.trim()) {
      setLocError(t("selectSiteError"));
      return;
    }
    setLocError(null);
    onParts();
  };

  return (
    <div className="p-inv" data-testid="inventory-device-view">
      <DeviceHeader
        resolution={resolution}
        captured={null}
        hideSourceBanner
        actions={
          <button type="button" className="p-close" onClick={onClose} aria-label={t("scanAnotherAria")}>
            ×
          </button>
        }
      />

      <div className="p-inv__body">
        <div className="p-lead p-inv__lead" data-s="inventory" data-testid="inventory-lead">
          <strong>{t("alreadyInInventory", { inventoryNumber: inv })}</strong>
          <span>{t("confirmPlaceOfUse")}</span>
        </div>

        <InventoryLocationCheck error={locError} />

        <div className="p-inv__meta" data-testid="inventory-meta">
          {tags.length > 0 && (
            <div className="p-inv__tags">
              {tags.map((tag) => (
                <span key={tag} className="p-cls-tag" data-c="v">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <Link href="/devices" className="p-inv__record-link" data-testid="inventory-record-link">
            {t("viewRecord")}
          </Link>
        </div>
      </div>

      <div className="p-two p-inv__actions">
        <button type="button" className="p-big" data-p="1" onClick={goService} data-testid="continue-service-request">
          <b>{t("requestService")}</b>
          <span>{t("requestServiceHint")}</span>
        </button>
        <button type="button" className="p-big" onClick={goParts} data-testid="open-parts">
          <b>{t("orderSpareParts")}</b>
          <span>{t("orderSparePartsHint")}</span>
        </button>
      </div>
    </div>
  );
}

export function DeviceScreen() {
  const t = useTranslations("device");
  const {
    resolution,
    captured,
    partsAllowed,
    isCatalogModel,
    isBeudamed,
    isInventory,
    catalogAdopted,
    adoptCatalog,
    backFromActions,
    continueToServiceRequest,
    openParts,
    reset,
  } = useCatalogAdopt();

  if (isCatalogModel && resolution) {
    if (!catalogAdopted) {
      return <CatalogModelView resolution={resolution} onAdopt={adoptCatalog} onClose={reset} />;
    }
    return (
      <CatalogActionView
        resolution={resolution}
        onService={continueToServiceRequest}
        onParts={openParts}
        onBack={backFromActions}
        onClose={reset}
      />
    );
  }

  if (isBeudamed && resolution) {
    return (
      <BeudamedExternalView
        resolution={resolution}
        onAdopt={continueToServiceRequest}
        onClose={reset}
      />
    );
  }

  if (isInventory && resolution?.device) {
    return (
      <InventoryDeviceView
        resolution={resolution}
        onService={continueToServiceRequest}
        onParts={openParts}
        onClose={reset}
      />
    );
  }

  return (
    <div data-testid="device-screen">
      <DeviceHeader
        resolution={resolution}
        captured={captured}
        actions={
          <button type="button" className="p-close" onClick={reset} aria-label={t("scanAnotherAria")}>
            ×
          </button>
        }
      />

      <div className="p-two">
        <button type="button" className="p-big" data-p="1" onClick={continueToServiceRequest} data-testid="continue-service-request">
          <b>{t("serviceRequest")}</b>
          <span>{t("serviceRequestHintDevice")}</span>
        </button>
        <button
          type="button"
          className="p-big"
          onClick={openParts}
          disabled={!partsAllowed}
          data-testid="open-parts"
        >
          <b>{t("spareParts")}</b>
          <span>{partsAllowed ? t("sparePartsHint") : t("sparePartsUnavailable")}</span>
        </button>
      </div>
    </div>
  );
}
