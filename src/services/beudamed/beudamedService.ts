import type { DeviceModelDTO, ParsedIdentifier } from "@/interfaces";
import { env } from "@/lib/env";
import { isFresh } from "@/lib/expiry";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { DAY_MS, HOUR_MS, RateLimiter } from "@/lib/rateLimit";
import { mapBeudamedToDeviceModel, selectBeudamedLookup } from "@/services/adapters/beudamedAdapters";
import type { BeudamedRawLookup } from "@/services/adapters/types";
import { recordExternalCall } from "@/services/shared/externalCallLog";
import { toDeviceModelDTO } from "@/services/shared/mappers";

/**
 * Stage 3 — FA-103 / SS-201 / NFA-801 / NFA-807.
 *
 *   check ExternalSourceRecord (90-day TTL)  → cached hit
 *   rate limits (per identifier / per tenant) → skip (miss)
 *   external lookup with AbortController      → map → upsert DeviceModel + record
 *   any failure                               → throw; resolveService logs and falls to stage 4
 *
 * The raw payload is stored but never returned (Section 29).
 */
export interface BeudamedResult {
  model: DeviceModelDTO;
  fetchedAt: Date;
  cached: boolean;
}

export interface BeudamedResolver {
  resolve(identifier: ParsedIdentifier, tenantId: string, correlationId?: string): Promise<BeudamedResult | null>;
}

interface Deps {
  lookup?: BeudamedRawLookup;
  perIdentifier?: RateLimiter;
  perTenant?: RateLimiter;
  now?: () => Date;
}

export function createBeudamedService(deps: Deps = {}): BeudamedResolver {
  const lookup = deps.lookup ?? selectBeudamedLookup();
  const perIdentifier = deps.perIdentifier ?? new RateLimiter(env.beudamed.rateLimitPerIdentifierPerHour, HOUR_MS);
  const perTenant = deps.perTenant ?? new RateLimiter(env.beudamed.rateLimitPerTenantPerDay, DAY_MS);
  const now = deps.now ?? (() => new Date());

  return {
    async resolve(identifier, tenantId, correlationId) {
      const udiDi = identifier.udiDi ?? identifier.gtin;
      if (!udiDi) {
        logger.info("beudamed.request", { correlationId, tenantId, skipped: true, reason: "no_udiDi" });
        logger.info("beudamed.response", { correlationId, hit: false, reason: "no_udiDi" });
        return null;
      }
      const started = Date.now();
      logger.info("beudamed.request", {
        correlationId,
        tenantId,
        udiDi,
        adapterMode: env.beudamed.adapterMode,
      });

      // 1. Cache (SS-201) — freshest record for this identifier.
      const cached = await prisma.externalSourceRecord.findFirst({
        where: { source: "beudamed", identifier: udiDi },
        orderBy: { fetchedAt: "desc" },
        include: { deviceModel: true },
      });
      if (cached && isFresh(cached.fetchedAt, env.beudamed.cacheTtlDays, now())) {
        await recordExternalCall({
          system: "beudamed", operation: "lookup", identifier: udiDi, tenantId, correlationId,
          durationMs: Date.now() - started, cacheHit: true, success: true,
        });
        const model = toDeviceModelDTO(cached.deviceModel);
        logger.info("beudamed.response", {
          correlationId,
          hit: true,
          cached: true,
          durationMs: Date.now() - started,
          modelId: model.id,
          tradeName: model.tradeName,
          udiDi: model.udiDi,
        });
        return { model, fetchedAt: cached.fetchedAt, cached: true };
      }

      // 2. Rate limits — a limited call is a miss, not an error.
      if (!perIdentifier.tryAcquire(udiDi) || !perTenant.tryAcquire(tenantId)) {
        logger.warn("beudamed.rate_limited", { tenantId, correlationId });
        await recordExternalCall({
          system: "beudamed", operation: "lookup", identifier: udiDi, tenantId, correlationId,
          durationMs: Date.now() - started, cacheHit: false, success: false, error: "rate_limited",
        });
        // A stale cache entry is still better than nothing when we may not call out.
        if (cached) {
          const model = toDeviceModelDTO(cached.deviceModel);
          logger.info("beudamed.response", {
            correlationId,
            hit: true,
            cached: true,
            stale: true,
            reason: "rate_limited",
            durationMs: Date.now() - started,
            modelId: model.id,
            tradeName: model.tradeName,
          });
          return { model, fetchedAt: cached.fetchedAt, cached: true };
        }
        logger.info("beudamed.response", {
          correlationId,
          hit: false,
          reason: "rate_limited",
          durationMs: Date.now() - started,
        });
        return null;
      }

      // 3. External call with a hard timeout (NFA-801).
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), env.beudamed.timeoutMs);
      try {
        const raw = await lookup.lookup(udiDi, controller.signal);
        const fetchedAt = now();
        if (!raw) {
          await recordExternalCall({
            system: "beudamed", operation: "lookup", identifier: udiDi, tenantId, correlationId,
            durationMs: Date.now() - started, cacheHit: false, success: true, httpStatus: 404,
          });
          logger.info("beudamed.response", {
            correlationId,
            hit: false,
            httpStatus: 404,
            durationMs: Date.now() - started,
          });
          return null;
        }

        // 4. Map + persist (FA-103): versioned master record + raw payload.
        const mapped = mapBeudamedToDeviceModel(raw.payload as Record<string, unknown>, udiDi, fetchedAt);
        const model = await prisma.$transaction(async (tx) => {
          const existing = await tx.deviceModel.findFirst({
            where: { OR: [{ udiDi }, ...(mapped.basicUdiDi ? [{ basicUdiDi: mapped.basicUdiDi }] : [])] },
            orderBy: { version: "desc" },
          });
          const data = {
            basicUdiDi: mapped.basicUdiDi,
            udiDi: mapped.udiDi,
            gtins: JSON.stringify(mapped.gtins),
            manufacturer: mapped.manufacturer,
            manufacturerSrn: mapped.manufacturerSrn,
            tradeName: mapped.tradeName,
            modelName: mapped.modelName,
            riskClass: mapped.riskClass,
            emdnCode: mapped.emdnCode,
            gmdnCode: mapped.gmdnCode,
            source: "beudamed",
            sourceFetchedAt: fetchedAt,
            state: "review",
          };
          const row = existing
            ? await tx.deviceModel.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } })
            : await tx.deviceModel.create({ data });
          await tx.externalSourceRecord.create({
            data: { deviceModelId: row.id, source: "beudamed", identifier: udiDi, payload: JSON.stringify(raw.payload), fetchedAt },
          });
          return row;
        });

        await recordExternalCall({
          system: "beudamed", operation: "lookup", identifier: udiDi, tenantId, correlationId,
          durationMs: Date.now() - started, cacheHit: false, success: true, httpStatus: raw.status,
        });
        const dto = toDeviceModelDTO(model);
        logger.info("beudamed.response", {
          correlationId,
          hit: true,
          cached: false,
          httpStatus: raw.status,
          durationMs: Date.now() - started,
          modelId: dto.id,
          tradeName: dto.tradeName,
          udiDi: dto.udiDi,
          manufacturer: dto.manufacturer,
          riskClass: dto.riskClass,
        });
        return { model: dto, fetchedAt, cached: false };
      } catch (error) {
        const timedOut = controller.signal.aborted;
        await recordExternalCall({
          system: "beudamed", operation: "lookup", identifier: udiDi, tenantId, correlationId,
          durationMs: Date.now() - started, cacheHit: false, success: false,
          error: timedOut ? `timeout>${env.beudamed.timeoutMs}ms` : errorMessage(error),
        });
        logger.warn("beudamed.response", {
          correlationId,
          hit: false,
          error: timedOut ? `timeout>${env.beudamed.timeoutMs}ms` : errorMessage(error),
          durationMs: Date.now() - started,
        });
        throw error; // resolveService catches, logs, falls through to stage 4 (SS-201)
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export const beudamedService = createBeudamedService();
