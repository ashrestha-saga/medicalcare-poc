"use client";

import type { CapturedArticleDTO, ResolveResponse } from "@/interfaces";

export function SourceBanner({ resolution, captured }: { resolution: ResolveResponse | null; captured: CapturedArticleDTO | null }) {
  if (captured) {
    return (
      <div className="p-src" data-s="manual" data-testid="source-banner" data-source="manual">
        Manually captured, service only
        <br />
        Service only — not for sale
      </div>
    );
  }
  if (!resolution) return null;
  const system = resolution.source.system;
  if (system === "beudamed") {
    return (
      <div className="p-src" data-s="beudamed" data-testid="source-banner" data-source="beudamed">
        BEUDAMED · EUDAMED mirror{resolution.source.cached ? " · cached" : ""}
      </div>
    );
  }
  if (system === "catalog" || system === "oxid-catalog") {
    return (
      <div className="p-src" data-s="catalog" data-testid="source-banner" data-source={system}>
        Article master (GTIN/UDI)
      </div>
    );
  }
  return (
    <div className="p-src" data-s="device-inventory" data-testid="source-banner" data-source={system}>
      Device inventory
    </div>
  );
}

export function DeviceHeader({
  resolution,
  captured,
  actions,
  hideSourceBanner = false,
}: {
  resolution: ResolveResponse | null;
  captured: CapturedArticleDTO | null;
  actions?: React.ReactNode;
  hideSourceBanner?: boolean;
}) {
  const device = resolution?.device;
  const model = resolution?.model;

  const title = captured?.name ?? model?.tradeName ?? model?.modelName ?? device?.inventoryNumber ?? "Device";
  const codes = [
    device?.inventoryNumber,
    device?.serialNumber,
    model?.udiDi,
    model?.manufacturer,
    model?.modelName,
    captured?.number,
  ].filter(Boolean) as string[];

  return (
    <section className="p-devhead" data-testid="device-header">
      {actions}
      {!hideSourceBanner && <SourceBanner resolution={resolution} captured={captured} />}
      <h2 data-testid="device-title" style={{ marginTop: 4 }}>
        {title}
      </h2>
      {codes.length > 0 && (
        <div className="codes">
          {codes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      )}
      {device?.location?.text && <div className="loc">{device.location.text}</div>}
      {device?.responsiblePerson && <div className="loc">{device.responsiblePerson}</div>}
    </section>
  );
}
