import type { DeviceModelDTO, ParsedIdentifier } from "@/interfaces";
import { env } from "@/lib/env";
import { logger, errorMessage } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { toDeviceModelDTO } from "@/services/shared/mappers";
import type { CatalogSearchAdapter, CatalogSearchHit } from "@/services/adapters/types";
import { oxidMockCatalogSearchAdapter } from "@/services/adapters/oxidMockAdapter";
import { oxidHttpCatalogSearchAdapter } from "@/services/adapters/oxidHttpAdapter";

/**
 * Stage 2 — FA-100 / FA-102 — article master.
 * Looks in the local DeviceModel table first, then asks the catalog adapter
 * (OXID). OXID hits are upserted into DeviceModel (FA-103-style) so the next
 * scan resolves locally. Never creates a DeviceInstance (FA-102).
 */
export interface CatalogResolver {
  find(
    identifier: ParsedIdentifier,
    tenantId: string,
    userId?: string,
  ): Promise<{ model: DeviceModelDTO; system: "catalog" | "oxid-catalog" } | null>;
}

export function selectCatalogSearchAdapter(mode = env.oxid.adapterMode): CatalogSearchAdapter {
  return mode === "http" ? oxidHttpCatalogSearchAdapter : oxidMockCatalogSearchAdapter;
}

function collectGtins(mapped: DeviceModelDTO, lookupGtin: string): string[] {
  const out: string[] = [];
  const add = (v: string | null | undefined) => {
    if (!v) return;
    if (!out.includes(v)) out.push(v);
  };
  add(lookupGtin);
  add(mapped.udiDi);
  for (const g of mapped.gtins) add(g);
  return out;
}

/** Persist an OXID (or mock) catalog hit as a DeviceModel + ExternalSourceRecord. */
export async function upsertOxidCatalogModel(
  hit: CatalogSearchHit,
  lookupGtin: string,
): Promise<DeviceModelDTO> {
  const mapped = hit.model;
  const udiDi = mapped.udiDi ?? lookupGtin;
  const gtins = collectGtins(mapped, lookupGtin);
  const fetchedAt = mapped.sourceFetchedAt ? new Date(mapped.sourceFetchedAt) : new Date();

  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.deviceModel.findFirst({
      where: {
        OR: [
          { udiDi },
          ...gtins.map((g) => ({ udiDi: g })),
          ...gtins.map((g) => ({ gtins: { contains: `"${g}"` } })),
        ],
      },
      orderBy: { version: "desc" },
    });

    const data = {
      basicUdiDi: mapped.basicUdiDi,
      udiDi,
      gtins: JSON.stringify(gtins),
      manufacturer: mapped.manufacturer,
      manufacturerSrn: mapped.manufacturerSrn,
      tradeName: mapped.tradeName,
      modelName: mapped.modelName,
      riskClass: mapped.riskClass,
      emdnCode: mapped.emdnCode,
      gmdnCode: mapped.gmdnCode,
      source: "catalog" as const,
      sourceFetchedAt: fetchedAt,
      state: mapped.state,
    };

    const model = existing
      ? await tx.deviceModel.update({
          where: { id: existing.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.deviceModel.create({ data });

    await tx.externalSourceRecord.create({
      data: {
        deviceModelId: model.id,
        source: "oxid",
        identifier: udiDi,
        payload: JSON.stringify(hit.raw ?? mapped),
        fetchedAt,
      },
    });

    return model;
  });

  return toDeviceModelDTO(row);
}

export function createCatalogService(adapter: CatalogSearchAdapter = selectCatalogSearchAdapter()): CatalogResolver {
  return {
    async find(identifier, tenantId, userId) {
      const gtin = identifier.udiDi ?? identifier.gtin;
      if (!gtin) {
        logger.info("catalog.skip_no_gtin", {
          kind: identifier.kind,
          raw: identifier.raw,
          adapter: adapter.name,
          adapterMode: env.oxid.adapterMode,
        });
        return null;
      }

      logger.info("catalog.local.lookup", { gtin, tenantId });
      const local = await prisma.deviceModel.findFirst({
        where: {
          OR: [{ udiDi: gtin }, { basicUdiDi: gtin }, { gtins: { contains: `"${gtin}"` } }],
        },
        orderBy: { version: "desc" },
      });
      if (local) {
        logger.info("catalog.local.hit", { gtin, modelId: local.id, tradeName: local.tradeName });
        return { model: toDeviceModelDTO(local), system: "catalog" };
      }
      logger.info("catalog.local.miss", { gtin });

      try {
        logger.info("catalog.adapter.request", {
          adapter: adapter.name,
          adapterMode: env.oxid.adapterMode,
          gtin,
          userId: userId ?? null,
          tenantId,
        });
        const external = await adapter.search(identifier, { userId, tenantId });
        if (external) {
          const persisted = await upsertOxidCatalogModel(external, gtin);
          logger.info("catalog.adapter.response", {
            adapter: adapter.name,
            hit: true,
            upserted: true,
            modelId: persisted.id,
            tradeName: persisted.tradeName,
            modelName: persisted.modelName,
            gtins: persisted.gtins,
            manufacturer: persisted.manufacturer,
          });
          return { model: persisted, system: "oxid-catalog" };
        }
        logger.info("catalog.adapter.response", { adapter: adapter.name, hit: false, gtin });
      } catch (error) {
        // Catalog trouble is not the user's problem: log and let stage 3/4 handle it.
        logger.warn("catalog.adapter.response", {
          adapter: adapter.name,
          hit: false,
          gtin,
          error: errorMessage(error),
        });
      }
      return null;
    },
  };
}

export const catalogService = createCatalogService();

export async function findModelById(id: string): Promise<DeviceModelDTO | null> {
  const row = await prisma.deviceModel.findUnique({ where: { id } });
  return row ? toDeviceModelDTO(row) : null;
}
