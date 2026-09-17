import type {
  CatalogClassificationSummary,
  CatalogModelDetailDTO,
  CatalogModelImportResult,
  CatalogModelListItemDTO,
  CatalogSpreadRow,
  TenantContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { parseJson } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { toDeviceModelDTO } from "@/services/shared/mappers";
import type { CreateCatalogModelInput, UpdateCatalogModelInput } from "@/schemas/catalogModel";
import type { ClassificationProposal, DeviceModel, Prisma } from "@prisma/client";

type ModelWithAggregates = DeviceModel & {
  classificationProposals: ClassificationProposal[];
  instances: { id: string; area: { siteId: string } | null }[];
};

function displayName(row: DeviceModel): string {
  return row.tradeName?.trim() || row.modelName?.trim() || row.basicUdiDi?.trim() || row.id;
}

function gtinCoverage(row: DeviceModel): number {
  const gtins = parseJson<string[]>(row.gtins, []);
  const checks = [Boolean(row.basicUdiDi?.trim()), Boolean(row.udiDi?.trim()), gtins.length > 0];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function latestProposal(proposals: ClassificationProposal[]): CatalogClassificationSummary | null {
  const latest = proposals[0];
  if (!latest) return null;
  return {
    annex1: latest.annex1,
    annex2: latest.annex2,
    softwareClass: latest.softwareClass,
    radiation: latest.radiation,
    confidence: latest.confidence,
    source: latest.source,
  };
}

function toListItem(row: ModelWithAggregates): CatalogModelListItemDTO {
  const siteIds = new Set(
    row.instances.map((i) => i.area?.siteId).filter((id): id is string => Boolean(id)),
  );
  return {
    ...toDeviceModelDTO(row),
    displayName: displayName(row),
    classification: latestProposal(row.classificationProposals),
    copyCount: row.instances.length,
    siteCount: siteIds.size,
    gtinCoverage: gtinCoverage(row),
  };
}

async function buildSpread(modelId: string, tenantId: string): Promise<CatalogSpreadRow[]> {
  const instances = await prisma.deviceInstance.findMany({
    where: { modelId, tenantId },
    select: {
      area: { select: { site: { select: { id: true, name: true } } } },
    },
  });
  const bySite = new Map<string, { siteName: string; copyCount: number }>();
  for (const row of instances) {
    const site = row.area?.site;
    if (!site) continue;
    const prev = bySite.get(site.id);
    if (prev) prev.copyCount += 1;
    else bySite.set(site.id, { siteName: site.name, copyCount: 1 });
  }
  return [...bySite.entries()]
    .map(([siteId, v]) => ({ siteId, siteName: v.siteName, copyCount: v.copyCount }))
    .sort((a, b) => b.copyCount - a.copyCount || a.siteName.localeCompare(b.siteName));
}

async function toDetail(row: ModelWithAggregates, tenantId: string): Promise<CatalogModelDetailDTO> {
  const spread = await buildSpread(row.id, tenantId);
  return {
    ...toListItem(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    spread,
  };
}

function listIncludeForTenant(tenantId: string) {
  return {
    classificationProposals: { orderBy: { createdAt: "desc" as const }, take: 1 },
    instances: {
      where: { tenantId },
      select: {
        id: true,
        area: { select: { siteId: true } },
      },
    },
  } satisfies Prisma.DeviceModelInclude;
}

function normalizeGtins(gtins: string[] | undefined): string | null {
  if (!gtins) return null;
  const cleaned = [...new Set(gtins.map((g) => g.trim()).filter(Boolean))];
  return cleaned.length ? JSON.stringify(cleaned) : null;
}

/**
 * Central DeviceModel master data; inventory counts are scoped to the session tenant.
 * Reads: catalog:view. Writes: catalog:update (admins only).
 */
export const deviceModelCatalogService = {
  async list(ctx: TenantContext, q?: string): Promise<CatalogModelListItemDTO[]> {
    requirePermission(ctx, "catalog:view");
    const needle = q?.trim();
    const rows = await prisma.deviceModel.findMany({
      where: needle
        ? {
            OR: [
              { tradeName: { contains: needle } },
              { modelName: { contains: needle } },
              { manufacturer: { contains: needle } },
              { basicUdiDi: { contains: needle } },
              { udiDi: { contains: needle } },
              { gtins: { contains: needle } },
              { emdnCode: { contains: needle } },
              { gmdnCode: { contains: needle } },
            ],
          }
        : undefined,
      include: listIncludeForTenant(ctx.tenantId),
      orderBy: [{ manufacturer: "asc" }, { tradeName: "asc" }, { modelName: "asc" }],
    });
    return rows.map(toListItem);
  },

  async getById(ctx: TenantContext, id: string): Promise<CatalogModelDetailDTO> {
    requirePermission(ctx, "catalog:view");
    const row = await prisma.deviceModel.findUnique({
      where: { id },
      include: listIncludeForTenant(ctx.tenantId),
    });
    if (!row) throw notFound("Model not found.");
    return toDetail(row, ctx.tenantId);
  },

  async create(ctx: TenantContext, input: CreateCatalogModelInput): Promise<CatalogModelListItemDTO> {
    requirePermission(ctx, "catalog:update");
    if (input.basicUdiDi) {
      const clash = await prisma.deviceModel.findUnique({ where: { basicUdiDi: input.basicUdiDi } });
      if (clash) throw conflict("A model with this Basic UDI-DI already exists.");
    }
    const created = await prisma.deviceModel.create({
      data: {
        basicUdiDi: input.basicUdiDi ?? null,
        udiDi: input.udiDi ?? null,
        gtins: normalizeGtins(input.gtins),
        manufacturer: input.manufacturer ?? null,
        manufacturerSrn: input.manufacturerSrn ?? null,
        tradeName: input.tradeName ?? null,
        modelName: input.modelName ?? null,
        riskClass: input.riskClass ?? null,
        emdnCode: input.emdnCode ?? null,
        gmdnCode: input.gmdnCode ?? null,
        source: input.source ?? "manual",
        state: input.state ?? "draft",
      },
      include: listIncludeForTenant(ctx.tenantId),
    });
    return toListItem(created);
  },

  async update(ctx: TenantContext, id: string, input: UpdateCatalogModelInput): Promise<CatalogModelDetailDTO> {
    requirePermission(ctx, "catalog:update");
    const existing = await prisma.deviceModel.findUnique({
      where: { id },
      include: { classificationProposals: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!existing) throw notFound("Model not found.");

    if (input.basicUdiDi && input.basicUdiDi !== existing.basicUdiDi) {
      const clash = await prisma.deviceModel.findUnique({ where: { basicUdiDi: input.basicUdiDi } });
      if (clash) throw conflict("A model with this Basic UDI-DI already exists.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.deviceModel.update({
        where: { id },
        data: {
          ...(input.basicUdiDi !== undefined ? { basicUdiDi: input.basicUdiDi } : {}),
          ...(input.udiDi !== undefined ? { udiDi: input.udiDi } : {}),
          ...(input.gtins !== undefined ? { gtins: normalizeGtins(input.gtins) } : {}),
          ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer } : {}),
          ...(input.manufacturerSrn !== undefined ? { manufacturerSrn: input.manufacturerSrn } : {}),
          ...(input.tradeName !== undefined ? { tradeName: input.tradeName } : {}),
          ...(input.modelName !== undefined ? { modelName: input.modelName } : {}),
          ...(input.riskClass !== undefined ? { riskClass: input.riskClass } : {}),
          ...(input.emdnCode !== undefined ? { emdnCode: input.emdnCode } : {}),
          ...(input.gmdnCode !== undefined ? { gmdnCode: input.gmdnCode } : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.state !== undefined ? { state: input.state } : {}),
          version: { increment: 1 },
        },
      });

      if (input.classification) {
        const prev = existing.classificationProposals[0];
        const annex1 =
          input.classification.annex1 !== undefined ? input.classification.annex1 : (prev?.annex1 ?? null);
        const annex2 =
          input.classification.annex2 !== undefined ? input.classification.annex2 : (prev?.annex2 ?? null);
        const softwareClass =
          input.classification.softwareClass !== undefined
            ? input.classification.softwareClass
            : (prev?.softwareClass ?? null);
        const radiation =
          input.classification.radiation !== undefined
            ? input.classification.radiation
            : (prev?.radiation ?? null);

        await tx.classificationProposal.create({
          data: {
            deviceModelId: id,
            ruleId: prev?.ruleId ?? null,
            annex1,
            annex2,
            softwareClass,
            radiation,
            confidence: prev?.confidence ?? "verified",
            source: prev?.source ?? "catalog:admin-update",
          },
        });
      }
    });

    return this.getById(ctx, id);
  },

  async importRows(ctx: TenantContext, rows: UpdateCatalogModelInput[]): Promise<CatalogModelImportResult> {
    requirePermission(ctx, "catalog:update");
    if (!rows.length) throw unprocessable("No rows to import.");

    const result: CatalogModelImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const label = row.tradeName || row.modelName || row.basicUdiDi || row.udiDi || `row ${i + 1}`;
      try {
        if (!row.tradeName && !row.modelName && !row.basicUdiDi && !row.udiDi) {
          result.skipped += 1;
          result.errors.push(`${label}: missing identity (tradeName / modelName / UDI).`);
          continue;
        }

        let existing: DeviceModel | null = null;
        if (row.basicUdiDi) {
          existing = await prisma.deviceModel.findUnique({ where: { basicUdiDi: row.basicUdiDi } });
        }
        if (!existing && row.udiDi) {
          existing = await prisma.deviceModel.findFirst({ where: { udiDi: row.udiDi } });
        }

        if (existing) {
          await prisma.deviceModel.update({
            where: { id: existing.id },
            data: {
              ...(row.basicUdiDi !== undefined ? { basicUdiDi: row.basicUdiDi } : {}),
              ...(row.udiDi !== undefined ? { udiDi: row.udiDi } : {}),
              ...(row.gtins !== undefined ? { gtins: normalizeGtins(row.gtins) } : {}),
              ...(row.manufacturer !== undefined ? { manufacturer: row.manufacturer } : {}),
              ...(row.manufacturerSrn !== undefined ? { manufacturerSrn: row.manufacturerSrn } : {}),
              ...(row.tradeName !== undefined ? { tradeName: row.tradeName } : {}),
              ...(row.modelName !== undefined ? { modelName: row.modelName } : {}),
              ...(row.riskClass !== undefined ? { riskClass: row.riskClass } : {}),
              ...(row.emdnCode !== undefined ? { emdnCode: row.emdnCode } : {}),
              ...(row.gmdnCode !== undefined ? { gmdnCode: row.gmdnCode } : {}),
              ...(row.source !== undefined ? { source: row.source } : {}),
              ...(row.state !== undefined ? { state: row.state } : {}),
              version: { increment: 1 },
            },
          });
          result.updated += 1;
        } else {
          await prisma.deviceModel.create({
            data: {
              basicUdiDi: row.basicUdiDi ?? null,
              udiDi: row.udiDi ?? null,
              gtins: normalizeGtins(row.gtins),
              manufacturer: row.manufacturer ?? null,
              manufacturerSrn: row.manufacturerSrn ?? null,
              tradeName: row.tradeName ?? null,
              modelName: row.modelName ?? null,
              riskClass: row.riskClass ?? null,
              emdnCode: row.emdnCode ?? null,
              gmdnCode: row.gmdnCode ?? null,
              source: row.source ?? "catalog",
              state: row.state ?? "draft",
            },
          });
          result.created += 1;
        }
      } catch (err) {
        result.skipped += 1;
        result.errors.push(`${label}: ${err instanceof Error ? err.message : "import failed"}`);
      }
    }

    return result;
  },
};
