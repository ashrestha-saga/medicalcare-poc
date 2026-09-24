import type { ParsedIdentifier, ResolveResponse } from "@/interfaces";
import { errorMessage, logger } from "@/lib/logger";
import { beudamedService, type BeudamedResolver } from "@/services/beudamed/beudamedService";
import { catalogService, findModelById, type CatalogResolver } from "@/services/catalog/catalogService";
import { deviceInventoryService, type InventoryResolver } from "@/services/inventory/deviceInventoryService";

/**
 * FA-100 — one endpoint, four stages, in order:
 *   1 inventory → 2 catalog → 3 BEUDAMED → 4 manual capture
 *
 * Stage 2/3 return a model and never create a DeviceInstance (FA-102).
 * Stage 3 failures are logged and swallowed (SS-201) — the client only ever
 * sees a calm "capture" response.
 *
 * Service-type selection is manual — no classification proposal engine.
 */
interface Deps {
  inventory?: InventoryResolver;
  catalog?: CatalogResolver;
  beudamed?: BeudamedResolver;
  now?: () => Date;
}

function idSummary(identifier: ParsedIdentifier) {
  return {
    kind: identifier.kind,
    raw: identifier.raw,
    gtin: identifier.gtin ?? null,
    udiDi: identifier.udiDi ?? null,
    serial: identifier.serial ?? null,
    text: identifier.text ?? null,
  };
}

function responseSummary(response: ResolveResponse) {
  return {
    stage: response.stage,
    source: response.source,
    correlationId: response.correlationId,
    deviceId: response.device?.id ?? null,
    modelId: response.model?.id ?? null,
    tradeName: response.model?.tradeName ?? null,
    gtins: response.model?.gtins ?? null,
  };
}

export function createResolveService(deps: Deps = {}) {
  const inventory = deps.inventory ?? deviceInventoryService;
  const catalog = deps.catalog ?? catalogService;
  const beudamed = deps.beudamed ?? beudamedService;
  const now = deps.now ?? (() => new Date());

  return {
    async resolve(
      identifier: ParsedIdentifier,
      tenantId: string,
      correlationId: string,
      userId?: string,
    ): Promise<ResolveResponse> {
      logger.info("resolve.start", {
        correlationId,
        tenantId,
        userId: userId ?? null,
        identifier: idSummary(identifier),
      });

      logger.info("resolve.stage1.inventory.request", { correlationId, identifier: idSummary(identifier) });
      const device = await inventory.find(identifier, tenantId);
      if (device) {
        const model = device.modelId ? await findModelById(device.modelId) : null;
        const response: ResolveResponse = {
          stage: "inventory",
          identifier,
          device,
          model: model ?? undefined,
          source: { system: "device-inventory", fetchedAt: now().toISOString(), cached: false },
          correlationId,
        };
        logger.info("resolve.stage1.inventory.response", { hit: true, ...responseSummary(response) });
        logger.info("resolve.done", responseSummary(response));
        return response;
      }
      logger.info("resolve.stage1.inventory.response", { correlationId, hit: false });

      logger.info("resolve.stage2.catalog.request", { correlationId, identifier: idSummary(identifier) });
      const catalogHit = await catalog.find(identifier, tenantId, userId);
      if (catalogHit) {
        const response: ResolveResponse = {
          stage: "catalog",
          identifier,
          model: catalogHit.model,
          source: { system: catalogHit.system, fetchedAt: now().toISOString(), cached: catalogHit.system === "catalog" },
          correlationId,
        };
        logger.info("resolve.stage2.catalog.response", { hit: true, ...responseSummary(response) });
        logger.info("resolve.done", responseSummary(response));
        return response;
      }
      logger.info("resolve.stage2.catalog.response", { correlationId, hit: false });

      logger.info("resolve.stage3.beudamed.request", { correlationId, identifier: idSummary(identifier) });
      try {
        const hit = await beudamed.resolve(identifier, tenantId, correlationId);
        if (hit) {
          const response: ResolveResponse = {
            stage: "beudamed",
            identifier,
            model: hit.model,
            source: { system: "beudamed", fetchedAt: hit.fetchedAt.toISOString(), cached: hit.cached },
            correlationId,
          };
          logger.info("resolve.stage3.beudamed.response", { hit: true, ...responseSummary(response) });
          logger.info("resolve.done", responseSummary(response));
          return response;
        }
        logger.info("resolve.stage3.beudamed.response", { correlationId, hit: false });
      } catch (error) {
        logger.warn("resolve.stage3.beudamed.response", {
          correlationId,
          hit: false,
          tenantId,
          kind: identifier.kind,
          error: errorMessage(error),
        });
      }

      logger.info("resolve.stage4.capture.request", { correlationId, identifier: idSummary(identifier) });
      const capture: ResolveResponse = {
        stage: "capture",
        identifier,
        source: { system: "none", fetchedAt: now().toISOString(), cached: false },
        correlationId,
      };
      logger.info("resolve.stage4.capture.response", responseSummary(capture));
      logger.info("resolve.done", responseSummary(capture));
      return capture;
    },
  };
}

export const resolveService = createResolveService();
