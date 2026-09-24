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
import type { DeviceModel, DeviceModelClassification, Prisma } from "@prisma/client";

type ModelWithAggregates = DeviceModel & {
  classifications: DeviceModelClassification[];
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

function openClassification(rows: DeviceModelClassification[]): CatalogClassificationSummary | null {
  const latest = rows.find((c) => c.validTo == null) ?? rows[0];
  if (!latest) return null;
  return {
    annex1: latest.stk,
    annex2: latest.mtkItemId != null || isAnnex2Asserted(latest.evidenceText),
    softwareClass: latest.softwareClass,
    radiation: latest.radiation,
    confidence: latest.confidence,
    source: latest.evidenceText ?? "model-classification",
  };
}

/** Admin toggled Annex 2 without choosing a specific Anlage-2 item yet. */
function isAnnex2Asserted(evidenceText: string | null | undefined): boolean {
  return Boolean(evidenceText?.includes("annex2-asserted"));
}

/**
 * Resolve MTK / Annex 2 for catalog admin edits.
 * - annex2 false → clear item + assertion
 * - annex2 true → keep existing item, or mark asserted if none
 * - annex2 omitted → keep previous
 */
function resolveAnnex2Write(
  annex2: boolean | null | undefined,
  prevMtkItemId: string | null,
  prevEvidence: string | null | undefined,
): { mtkItemId: string | null; evidenceText: string } {
  if (annex2 === false) {
    return { mtkItemId: null, evidenceText: "catalog:admin-update" };
  }
  if (annex2 === true) {
    if (prevMtkItemId) {
      return {
        mtkItemId: prevMtkItemId,
        evidenceText: prevEvidence?.includes("annex2-asserted")
          ? "catalog:admin-update"
          : (prevEvidence ?? "catalog:admin-update"),
      };
    }
    return { mtkItemId: null, evidenceText: "catalog:annex2-asserted" };
  }
  return {
    mtkItemId: prevMtkItemId,
    evidenceText: prevEvidence ?? "catalog:admin-update",
  };
}


function toListItem(row: ModelWithAggregates): CatalogModelListItemDTO {
  const siteIds = new Set(
    row.instances.map((i) => i.area?.siteId).filter((id): id is string => Boolean(id)),
  );
  return {
    ...toDeviceModelDTO(row),
    displayName: displayName(row),
    classification: openClassification(row.classifications),
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
    classifications: { where: { validTo: null }, orderBy: { validFrom: "desc" as const }, take: 1 },
    instances: {
      where: { tenantId },
      select: {
        id: true,
        area: { select: { siteId: true } },
      },
    },
  } satisfies Prisma.DeviceModelInclude;
}

function normalizeGtins(gtins: string[] | null | undefined): string | null {
  if (!gtins?.length) return null;
  return JSON.stringify(gtins);
}

export const deviceModelCatalogService = {
  async list(ctx: TenantContext, q?: string): Promise<CatalogModelListItemDTO[]> {
    requirePermission(ctx, "catalog:view");
    const where: Prisma.DeviceModelWhereInput = q?.trim()
      ? {
          OR: [
            { tradeName: { contains: q.trim() } },
            { modelName: { contains: q.trim() } },
            { manufacturer: { contains: q.trim() } },
            { udiDi: { contains: q.trim() } },
            { basicUdiDi: { contains: q.trim() } },
          ],
        }
      : {};
    const rows = await prisma.deviceModel.findMany({
      where,
      include: listIncludeForTenant(ctx.tenantId),
      orderBy: [{ tradeName: "asc" }, { modelName: "asc" }],
      take: 500,
    });
    return rows.map((r) => toListItem(r as ModelWithAggregates));
  },

  async getById(ctx: TenantContext, id: string): Promise<CatalogModelDetailDTO> {
    requirePermission(ctx, "catalog:view");
    const row = await prisma.deviceModel.findUnique({
      where: { id },
      include: listIncludeForTenant(ctx.tenantId),
    });
    if (!row) throw notFound("Model not found.");
    return toDetail(row as ModelWithAggregates, ctx.tenantId);
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
        maintenanceCycleMonths: input.maintenanceCycleMonths ?? null,
      },
      include: listIncludeForTenant(ctx.tenantId),
    });
    return toListItem(created as ModelWithAggregates);
  },

  async update(ctx: TenantContext, id: string, input: UpdateCatalogModelInput): Promise<CatalogModelDetailDTO> {
    requirePermission(ctx, "catalog:update");
    const existing = await prisma.deviceModel.findUnique({
      where: { id },
      include: { classifications: { where: { validTo: null }, take: 1, orderBy: { validFrom: "desc" } } },
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
          ...(input.maintenanceCycleMonths !== undefined
            ? { maintenanceCycleMonths: input.maintenanceCycleMonths }
            : {}),
          version: { increment: 1 },
        },
      });

      if (input.classification) {
        const prev = existing.classifications[0];
        const ruleSet =
          (await tx.refRuleSet.findFirst({ where: { code: "MPBETREIBV", validTo: null } })) ??
          (await tx.refRuleSet.findFirst());
        if (!ruleSet) throw unprocessable("Rule sets not loaded — please run the seed.");

        if (prev) {
          await tx.deviceModelClassification.update({
            where: { id: prev.id },
            data: { validTo: new Date() },
          });
        }

        const annex2Write = resolveAnnex2Write(
          input.classification.annex2,
          prev?.mtkItemId ?? null,
          prev?.evidenceText,
        );

        await tx.deviceModelClassification.create({
          data: {
            deviceModelId: id,
            stk: input.classification.annex1 ?? prev?.stk ?? false,
            radiation: input.classification.radiation ?? prev?.radiation ?? false,
            softwareClass:
              input.classification.softwareClass !== undefined
                ? input.classification.softwareClass
                : (prev?.softwareClass ?? null),
            mtkItemId: annex2Write.mtkItemId,
            confidence: prev?.confidence ?? "derived",
            evidenceText: annex2Write.evidenceText,
            ruleSetId: ruleSet.id,
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
              ...(row.maintenanceCycleMonths !== undefined
                ? { maintenanceCycleMonths: row.maintenanceCycleMonths }
                : {}),
              version: { increment: 1 },
            },
          });
          result.updated += 1;
        } else {
          await this.create(ctx, {
            tradeName: row.tradeName ?? null,
            modelName: row.modelName ?? null,
            manufacturer: row.manufacturer ?? null,
            manufacturerSrn: row.manufacturerSrn ?? null,
            basicUdiDi: row.basicUdiDi ?? null,
            udiDi: row.udiDi ?? null,
            gtins: row.gtins ?? undefined,
            riskClass: row.riskClass ?? null,
            emdnCode: row.emdnCode ?? null,
            gmdnCode: row.gmdnCode ?? null,
            source: row.source ?? "manual",
            state: row.state ?? "draft",
            maintenanceCycleMonths: row.maintenanceCycleMonths ?? null,
          });
          result.created += 1;
        }
      } catch (e) {
        result.errors.push(`${label}: ${e instanceof Error ? e.message : "import failed"}`);
        result.skipped += 1;
      }
    }

    return result;
  },
};
