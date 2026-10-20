import type { ParsedIdentifier, ResolveResponse, TenantContext } from "@/interfaces";
import { forbidden, notFound } from "@/lib/errors";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { beudamedService, type BeudamedResolver } from "@/services/beudamed/beudamedService";
import { catalogService, findModelById, type CatalogResolver } from "@/services/catalog/catalogService";
import { deviceInventoryService, type InventoryResolver } from "@/services/inventory/deviceInventoryService";
import {
  assertDeviceInWorkAreas,
  getEffectiveAreaScope,
  isAreaInScope,
} from "@/services/users/userAreaScope";
import { toDeviceInstanceDTO } from "@/services/shared/mappers";

/**
 * FA-100 — one endpoint, four stages, in order:
 *   1 inventory → (1b GTIN candidates) → 2 catalog → 3 BEUDAMED → 4 manual capture
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

export interface ResolveOptions {
  /** Skip GTIN multi-match picker (registration / “continue without selection”). */
  skipInventoryCandidates?: boolean;
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
    candidateCount: response.candidates?.length ?? 0,
  };
}

function gtinCode(identifier: ParsedIdentifier): string | null {
  const code = identifier.udiDi ?? identifier.gtin;
  return code?.trim() || null;
}

export function createResolveService(deps: Deps = {}) {
  const inventory = deps.inventory ?? deviceInventoryService;
  const catalog = deps.catalog ?? catalogService;
  const beudamed = deps.beudamed ?? beudamedService;
  const now = deps.now ?? (() => new Date());

  async function resolveFromCatalogOnward(
    identifier: ParsedIdentifier,
    tenantId: string,
    correlationId: string,
    userId?: string,
  ): Promise<ResolveResponse> {
    logger.info("resolve.stage2.catalog.request", { correlationId, identifier: idSummary(identifier) });
    const catalogHit = await catalog.find(identifier, tenantId, userId);
    if (catalogHit) {
      const response: ResolveResponse = {
        stage: "catalog",
        identifier,
        model: catalogHit.model,
        source: {
          system: catalogHit.system,
          fetchedAt: now().toISOString(),
          cached: catalogHit.system === "catalog",
        },
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
  }

  return {
    async resolve(
      identifier: ParsedIdentifier,
      tenantId: string,
      correlationId: string,
      userId?: string,
      areaCtx?: Pick<TenantContext, "tenantId" | "user">,
      options: ResolveOptions = {},
    ): Promise<ResolveResponse> {
      logger.info("resolve.start", {
        correlationId,
        tenantId,
        userId: userId ?? null,
        identifier: idSummary(identifier),
        skipInventoryCandidates: Boolean(options.skipInventoryCandidates),
      });

      logger.info("resolve.stage1.inventory.request", { correlationId, identifier: idSummary(identifier) });
      const device = await inventory.find(identifier, tenantId);
      if (device) {
        if (areaCtx) {
          const scope = await getEffectiveAreaScope(areaCtx);
          if (!isAreaInScope(scope, device.location?.areaId)) {
            throw forbidden("This device is outside your assigned work areas.");
          }
        }
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

      const code = gtinCode(identifier);
      if (code && !options.skipInventoryCandidates) {
        const candidates = await inventory.listByGtin(tenantId, code);
        if (candidates.length > 0) {
          const continueWithoutSelection = await resolveFromCatalogOnward(
            identifier,
            tenantId,
            correlationId,
            userId,
          );
          const response: ResolveResponse = {
            stage: "inventory-candidates",
            identifier,
            candidates,
            continueWithoutSelection,
            model: continueWithoutSelection.model,
            source: { system: "device-inventory", fetchedAt: now().toISOString(), cached: false },
            correlationId,
          };
          logger.info("resolve.stage1.candidates.response", {
            hit: true,
            ...responseSummary(response),
            fallbackStage: continueWithoutSelection.stage,
          });
          return response;
        }
      }

      return resolveFromCatalogOnward(identifier, tenantId, correlationId, userId);
    },

    /**
     * After GTIN candidate picker — bind to one inventory exemplar.
     * Work-area check runs here (on continue), not when listing candidates.
     */
    async selectDevice(
      ctx: Pick<TenantContext, "tenantId" | "user" | "correlationId">,
      deviceId: string,
      identifier: ParsedIdentifier,
    ): Promise<ResolveResponse> {
      const row = await prisma.deviceInstance.findFirst({
        where: { id: deviceId, tenantId: ctx.tenantId },
        include: {
          model: {
            include: {
              classifications: { where: { validTo: null }, take: 1, orderBy: { validFrom: "desc" as const } },
            },
          },
          area: { include: { site: true } },
          responsibleUser: { select: { id: true, name: true, email: true } },
        },
      });
      if (!row) throw notFound("Device not found.");

      await assertDeviceInWorkAreas(ctx, row.areaId);

      const device = toDeviceInstanceDTO(row);
      const model = device.modelId ? await findModelById(device.modelId) : null;
      const response: ResolveResponse = {
        stage: "inventory",
        identifier,
        device,
        model: model ?? undefined,
        source: { system: "device-inventory", fetchedAt: now().toISOString(), cached: false },
        correlationId: ctx.correlationId,
      };
      logger.info("resolve.select.done", responseSummary(response));
      return response;
    },
  };
}

export const resolveService = createResolveService();
