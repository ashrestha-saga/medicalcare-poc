"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  BeudamedExternalViewProps,
  CatalogActionViewProps,
  CatalogModelViewProps,
  InventoryDeviceViewProps,
} from "@/interfaces";
import { useCatalogAdopt } from "@/components/hooks/device/useCatalogAdopt";
import { useRequestStore } from "@/store/requestStore";
import { inspectionTagsFromFlags } from "@/lib/inspectionTags";
import { DeviceHeader } from "./DeviceHeader";
import { InventoryLocationCheck } from "./InventoryLocationCheck";

function formatFetchedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Stage 2 adopt — inventory miss, article master (local or OXID) knows the model. */
function CatalogModelView({ resolution, onAdopt, onClose }: CatalogModelViewProps) {
  const model = resolution.model;
  const title = model?.tradeName ?? model?.modelName ?? "Artikel";
  const code = model?.udiDi ?? model?.gtins?.[0] ?? resolution.identifier.udiDi ?? resolution.identifier.gtin ?? null;
  const isOxid = resolution.source.system === "oxid-catalog";

  return (
    <div className="p-adopt" data-adopt="catalog" data-testid="catalog-model-view">
      <section className="p-devhead p-adopt__head">
        <button type="button" className="p-close" onClick={onClose} aria-label="Scan another">
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
          Artikel aus dem Artikelstamm
          {isOxid ? " · OXID Shop" : ""}
        </p>
      </section>

      <div className="p-adopt__body">
        <div
          className="p-src p-adopt__src"
          data-s="catalog"
          data-testid="source-banner"
          data-source={resolution.source.system}
        >
          {isOxid ? "OXID Shop · Artikelstamm" : "Artikelstamm (lokal)"}
        </div>

        <div className="p-lead p-adopt__lead" data-s="catalog" data-testid="catalog-lead">
          Zu diesem Code ist kein Gerät hinterlegt. Der Artikelstamm kennt das Produkt — für die
          Serviceanfrage genügt das. Ein Gerätebuch entsteht dadurch nicht.
        </div>

        <p className="p-ext-note p-adopt__note">
          UDI-DI identifiziert das Modell, nicht das Exemplar.
        </p>

        <button type="button" className="p-cta p-adopt__cta" onClick={onAdopt} data-testid="adopt-catalog">
          Für Service übernehmen
        </button>
      </div>
    </div>
  );
}

/** After catalog adopt — choose service request or spare parts. */
function CatalogActionView({ resolution, onService, onParts, onBack, onClose }: CatalogActionViewProps) {
  return (
    <div data-testid="catalog-action-view">
      <DeviceHeader
        resolution={resolution}
        captured={null}
        actions={
          <>
            <button type="button" className="p-close" onClick={onBack} aria-label="Back" data-testid="catalog-action-back">
              ←
            </button>
            <button type="button" className="p-close" onClick={onClose} aria-label="Scan another">
              ×
            </button>
          </>
        }
      />

      <div className="p-two">
        <button type="button" className="p-big" data-p="1" onClick={onService} data-testid="continue-service-request">
          <b>Service request</b>
          <span>Inspection, repair or other service for this product.</span>
        </button>
        <button type="button" className="p-big" onClick={onParts} data-testid="open-parts">
          <b>Spare parts</b>
          <span>Request spare parts — approval by an authorized buyer required.</span>
        </button>
      </div>
    </div>
  );
}

/** EXTERNAL DATA — shown first when stage 3 (BEUDAMED / EUDAMED) answers. */
function BeudamedExternalView({ resolution, onAdopt, onClose }: BeudamedExternalViewProps) {
  const model = resolution.model;
  const title = model?.tradeName ?? model?.modelName ?? "Gerät";
  const udi = model?.udiDi ?? resolution.identifier.udiDi ?? resolution.identifier.gtin ?? null;
  const fetched = formatFetchedAt(resolution.source.fetchedAt);

  const rows: { label: string; value: string }[] = [
    model?.manufacturer ? { label: "Hersteller", value: model.manufacturer } : null,
    model?.riskClass ? { label: "Risikoklasse", value: model.riskClass } : null,
    model?.emdnCode ? { label: "EMDN", value: model.emdnCode } : null,
    model?.basicUdiDi ? { label: "Basis-UDI-DI", value: model.basicUdiDi } : null,
    model?.gmdnCode ? { label: "GMDN", value: model.gmdnCode } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="p-adopt" data-testid="beudamed-external-view">
      <section className="p-devhead p-adopt__head">
        <button type="button" className="p-close" onClick={onClose} aria-label="Scan another">
          ×
        </button>
        <h2 data-testid="device-title">{title}</h2>
        {(udi || model?.manufacturer) && (
          <div className="codes">
            {udi && <span>{udi}</span>}
            {model?.manufacturer && <span>{model.manufacturer}</span>}
          </div>
        )}
        <p className="p-adopt__status">Externe Herstellerdaten</p>
      </section>

      <div className="p-adopt__body">
        <div
          className="p-src p-adopt__src"
          data-s="beudamed"
          data-testid="source-banner"
          data-source="beudamed"
        >
          BEUDAMED · EUDAMED-Spiegelung
          {resolution.source.cached ? " · Cache" : ""} · Abgerufen {fetched}
        </div>

        <div className="p-lead p-adopt__lead" data-s="catalog" data-testid="beudamed-lead">
          Der Code ist lokal unbekannt. Herstellerdaten wurden aus dem BEUDAMED-Spiegel
          (EUDAMED) geladen und können für den Serviceauftrag übernommen werden.
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

        <p className="p-ext-note p-adopt__note">
          UDI-DI identifiziert das Modell, nicht das Exemplar. Ein Gerätedatensatz entsteht
          dadurch nicht.
        </p>

        <button type="button" className="p-cta p-adopt__cta" onClick={onAdopt} data-testid="continue-service-request">
          Für Service übernehmen
        </button>
      </div>
    </div>
  );
}

/** Stage 1 — device already in inventory: confirm Einsatzort, then service / parts. */
function InventoryDeviceView({ resolution, onService, onParts, onClose }: InventoryDeviceViewProps) {
  const device = resolution.device!;
  const proposal = resolution.classificationProposal;
  const siteId = useRequestStore((s) => s.form.siteId);
  const [locError, setLocError] = useState<string | null>(null);

  const inv = device.inventoryNumber;
  const tags = inspectionTagsFromFlags(device.classification ?? proposal ?? null);

  const goService = () => {
    if (!siteId.trim()) {
      setLocError("Bitte Standort wählen.");
      return;
    }
    setLocError(null);
    onService();
  };

  const goParts = () => {
    if (!siteId.trim()) {
      setLocError("Bitte Standort wählen.");
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
          <button type="button" className="p-close" onClick={onClose} aria-label="Scan another">
            ×
          </button>
        }
      />

      <div className="p-inv__body">
        <div className="p-lead p-inv__lead" data-s="inventory" data-testid="inventory-lead">
          <strong>Bereits im Bestandsverzeichnis · {inv}</strong>
          <span>Nur noch den Einsatzort bestätigen – die Gerätedaten stehen.</span>
        </div>

        <InventoryLocationCheck error={locError} />

        <div className="p-inv__meta" data-testid="inventory-meta">
          {tags.length > 0 && (
            <div className="p-inv__tags">
              {tags.map((t) => (
                <span key={t} className="p-cls-tag" data-c="v">
                  {t}
                </span>
              ))}
            </div>
          )}
          <Link href="/devices" className="p-inv__record-link" data-testid="inventory-record-link">
            Datensatz ansehen →
          </Link>
        </div>
      </div>

      <div className="p-two p-inv__actions">
        <button type="button" className="p-big" data-p="1" onClick={goService} data-testid="continue-service-request">
          <b>Service beauftragen</b>
          <span>Prüfung, Wartung oder Reparatur beim Servicepartner anfordern</span>
        </button>
        <button type="button" className="p-big" onClick={goParts} data-testid="open-parts">
          <b>Ersatzteile bestellen</b>
          <span>Zum Gerät passende Artikel über plusorder bestellen</span>
        </button>
      </div>
    </div>
  );
}

export function DeviceScreen() {
  const {
    resolution,
    captured,
    proposal,
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
          <button type="button" className="p-close" onClick={reset} aria-label="Scan another">
            ×
          </button>
        }
      />

      {proposal && (
        <div className="p-lead" data-s="catalog" data-testid="device-proposal">
          <span className="p-cls-tag" data-c={proposal.confidence === "verified" ? "v" : "d"}>
            {proposal.confidence}
          </span>{" "}
          {[
            proposal.annex1 && "Annex 1 (STK)",
            proposal.annex2 && "Annex 2 (MTK)",
            proposal.softwareClass && `Software ${proposal.softwareClass}`,
            proposal.radiation && "Radiation",
          ]
            .filter(Boolean)
            .join(" · ") || "No inspection obligations suggested"}
          <div style={{ marginTop: 6, opacity: 0.85 }}>
            A suggestion only — you choose and confirm the inspection type in the next step.
          </div>
        </div>
      )}

      <div className="p-two">
        <button type="button" className="p-big" data-p="1" onClick={continueToServiceRequest} data-testid="continue-service-request">
          <b>Service request</b>
          <span>Inspection, repair or other service for this device.</span>
        </button>
        <button
          type="button"
          className="p-big"
          onClick={openParts}
          disabled={!partsAllowed}
          data-testid="open-parts"
        >
          <b>Spare parts</b>
          <span>
            {partsAllowed
              ? "Request spare parts — approval by an authorized buyer required."
              : "Not available for manually captured devices."}
          </span>
        </button>
      </div>
    </div>
  );
}
