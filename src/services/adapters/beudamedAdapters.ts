import type { DeviceModelDTO } from "@/interfaces";
import type { BeudamedRawResponse } from "@/interfaces/external";
import { env } from "@/lib/env";
import { fetchWithTimeout } from "@/lib/http";
import { logger } from "@/lib/logger";
import type { BeudamedRawLookup } from "./types";

/**
 * Stage 3 adapters — SS-201. Modes via BEUDAMED_ADAPTER_MODE:
 *   stub  — never answers (stage 3 always misses); no network. Default.
 *   mock  — answers from an in-repo fixture; no network.
 *   http  — BEUDAMED OpenAPI (https://beudamed.com/api): EUDAMED device + FDA UDI by primary DI.
 */

export const beudamedStubLookup: BeudamedRawLookup = {
  async lookup(udiDi) {
    logger.info("beudamed.stub.request", { udiDi });
    logger.info("beudamed.stub.response", { udiDi, hit: false, reason: "stub_mode" });
    return null;
  },
};

/** Fixture shaped like OpenAPI `EudamedDevice`. */
const MOCK_FIXTURE: Record<string, BeudamedRawResponse> = {
  "04012345678949": {
    id: "04012345678949",
    provider: "eudamed",
    type: "device",
    primary_di: "04012345678949",
    name: "Ultrasound U7",
    basic_udi_di: "4012345U7BASIC00",
    basic_udi_di_id: null,
    manufacturer_name: "Example Imaging GmbH",
    regulation: "MDR",
    classification: "IIa",
    status: "on_market",
    legacy: false,
    device_criterion: null,
    reference: null,
    additional_description: null,
    cnd_nomenclatures: [{ code: "Z110101", description: "Ultrasound" }],
    web_path: "/eudamed/devices/04012345678949",
    eudamed_url: null,
    raw: {},
  },
};

export const beudamedMockLookup: BeudamedRawLookup = {
  async lookup(udiDi) {
    logger.info("beudamed.mock.request", { udiDi });
    const payload = MOCK_FIXTURE[udiDi] ?? MOCK_FIXTURE[udiDi.replace(/^0+/, "") || udiDi];
    logger.info("beudamed.mock.response", {
      udiDi,
      hit: Boolean(payload),
      rawPreview: payload ? JSON.stringify(payload).slice(0, 1500) : null,
    });
    return payload ? { status: 200, payload } : null;
  },
};

/** Path ids to try: GS1-14 and unpadded shop/primary-DI form. */
export function beudamedLookupIds(udiDi: string): string[] {
  const out: string[] = [];
  const add = (v: string) => {
    if (v && !out.includes(v)) out.push(v);
  };
  add(udiDi);
  add(udiDi.replace(/^0+/, "") || udiDi);
  return out;
}

async function fetchBeudamedJson(
  url: string,
  signal: AbortSignal | undefined,
): Promise<{ status: number; payload: BeudamedRawResponse | null; bodyText?: string }> {
  const res = await fetchWithTimeout(url, {
    timeoutMs: env.beudamed.timeoutMs,
    headers: { Authorization: `Bearer ${env.beudamed.apiKey}`, Accept: "application/json" },
    signal,
  });
  if (res.status === 404) return { status: 404, payload: null };
  if (!res.ok) {
    const bodyText = (await res.text().catch(() => "")).slice(0, 800);
    return { status: res.status, payload: null, bodyText };
  }
  return { status: res.status, payload: (await res.json()) as BeudamedRawResponse };
}

/**
 * Direct lookups per OpenAPI:
 *   GET /eudamed_devices/{id}  — EUDAMED device (UDI-DI / primary DI)
 *   GET /fda_udis/{id}         — FDA UDI by primary DI
 */
export const beudamedHttpLookup: BeudamedRawLookup = {
  async lookup(udiDi, signal) {
    if (!env.beudamed.apiKey || !env.beudamed.apiBaseUrl) {
      throw new Error("BEUDAMED not configured (missing key or base URL)");
    }
    const base = env.beudamed.apiBaseUrl.replace(/\/$/, "");
    const ids = beudamedLookupIds(udiDi);

    for (const id of ids) {
      const eudamedUrl = `${base}/eudamed_devices/${encodeURIComponent(id)}`;
      logger.info("beudamed.http.request", { url: eudamedUrl, udiDi, id, method: "GET", kind: "eudamed_device" });
      const eudamed = await fetchBeudamedJson(eudamedUrl, signal);
      if (eudamed.payload) {
        logger.info("beudamed.http.response", {
          udiDi,
          id,
          kind: "eudamed_device",
          httpStatus: eudamed.status,
          rawPreview: JSON.stringify(eudamed.payload).slice(0, 1500),
        });
        return { status: eudamed.status, payload: eudamed.payload };
      }
      if (eudamed.status !== 404) {
        logger.warn("beudamed.http.response", {
          udiDi,
          id,
          kind: "eudamed_device",
          httpStatus: eudamed.status,
          bodyText: eudamed.bodyText,
        });
        throw new Error(`BEUDAMED HTTP ${eudamed.status}`);
      }
      logger.info("beudamed.http.response", { udiDi, id, kind: "eudamed_device", httpStatus: 404, payload: null });
    }

    for (const id of ids) {
      const fdaUrl = `${base}/fda_udis/${encodeURIComponent(id)}`;
      logger.info("beudamed.http.request", { url: fdaUrl, udiDi, id, method: "GET", kind: "fda_udi" });
      const fda = await fetchBeudamedJson(fdaUrl, signal);
      if (fda.payload) {
        logger.info("beudamed.http.response", {
          udiDi,
          id,
          kind: "fda_udi",
          httpStatus: fda.status,
          rawPreview: JSON.stringify(fda.payload).slice(0, 1500),
        });
        return { status: fda.status, payload: fda.payload };
      }
      if (fda.status !== 404) {
        logger.warn("beudamed.http.response", {
          udiDi,
          id,
          kind: "fda_udi",
          httpStatus: fda.status,
          bodyText: fda.bodyText,
        });
        throw new Error(`BEUDAMED HTTP ${fda.status}`);
      }
      logger.info("beudamed.http.response", { udiDi, id, kind: "fda_udi", httpStatus: 404, payload: null });
    }

    return null;
  },
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length ? v : null;
}

function firstCndCode(raw: Record<string, unknown>): string | null {
  const list = raw.cnd_nomenclatures;
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (first && typeof first === "object") return asString((first as Record<string, unknown>).code);
  return null;
}

function firstGmdnCode(raw: Record<string, unknown>): string | null {
  const list = raw.gmdn_terms;
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (first && typeof first === "object") return asString((first as Record<string, unknown>).code);
  return null;
}

/**
 * Map BEUDAMED OpenAPI `EudamedDevice` / `FdaUdi` (and legacy nested fixtures) → DeviceModelDTO fields.
 */
export function mapBeudamedToDeviceModel(
  raw: BeudamedRawResponse,
  udiDi: string,
  fetchedAt: Date,
): Omit<DeviceModelDTO, "id" | "version" | "state"> {
  const r = raw as Record<string, unknown>;

  // OpenAPI EudamedDevice / FdaUdi (flat)
  const primaryDi = asString(r.primary_di) ?? asString(r.udiDi) ?? udiDi;
  const basicUdiDi = asString(r.basic_udi_di) ?? asString(r.basicUdiDi);
  const tradeName =
    asString(r.name) ?? asString(r.brand_name) ?? asString((r.device as Record<string, unknown> | undefined)?.tradeName);
  const modelName =
    asString(r.version_or_model_number) ??
    asString(r.catalog_number) ??
    asString(r.reference) ??
    asString((r.device as Record<string, unknown> | undefined)?.model);
  const manufacturer =
    asString(r.manufacturer_name) ??
    asString(r.company_name) ??
    asString((r.manufacturer as Record<string, unknown> | undefined)?.name);
  const manufacturerSrn = asString((r.manufacturer as Record<string, unknown> | undefined)?.srn);
  const riskClass =
    asString(r.classification) ?? asString((r.device as Record<string, unknown> | undefined)?.riskClass);
  const emdnCode = firstCndCode(r) ?? asString((r.nomenclature as Record<string, unknown> | undefined)?.emdn);
  const gmdnCode = firstGmdnCode(r) ?? asString((r.nomenclature as Record<string, unknown> | undefined)?.gmdn);

  return {
    basicUdiDi,
    udiDi: primaryDi,
    gtins: [primaryDi],
    manufacturer,
    manufacturerSrn,
    tradeName,
    modelName,
    riskClass,
    emdnCode,
    gmdnCode,
    source: "beudamed",
    sourceFetchedAt: fetchedAt.toISOString(),
    maintenanceCycleMonths: null,
  };
}

export function selectBeudamedLookup(mode = env.beudamed.adapterMode): BeudamedRawLookup {
  switch (mode) {
    case "mock":
      return beudamedMockLookup;
    case "http":
      return beudamedHttpLookup;
    default:
      return beudamedStubLookup;
  }
}
