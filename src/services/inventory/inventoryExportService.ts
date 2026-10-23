import { createHash } from "node:crypto";
import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";

const CSV_HEADERS = [
  "Inventarnummer",
  "Seriennummer",
  "UDI-DI",
  "Hersteller",
  "Modell",
  "Handelsname",
  "Standort",
  "Bereich",
  "Raum",
  "Verantwortlich",
  "Inbetriebnahme",
  "Status",
  "Produktart",
] as const;

export type InventoryExportFilters = {
  siteId?: string | null;
  areaId?: string | null;
};

function csvEscape(value: string): string {
  if (/[";\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function cell(v: string | null | undefined): string {
  return csvEscape((v ?? "").trim());
}

/**
 * §14 Bestandsverzeichnis — released devices only, DE CSV (BOM + `;` + CRLF).
 */
export const inventoryExportService = {
  async exportCsv(
    ctx: TenantWorkContext,
    filters: InventoryExportFilters = {},
  ): Promise<{ body: Buffer; filename: string; rowCount: number; sha256: string }> {
    requirePermission(ctx, "inventory:export");

    const rows = await prisma.deviceInstance.findMany({
      where: {
        state: "released",
        ...(filters.areaId
          ? { areaId: filters.areaId }
          : filters.siteId
            ? { area: { siteId: filters.siteId } }
            : {}),
      },
      include: {
        model: { select: { manufacturer: true, modelName: true, tradeName: true } },
        area: { include: { site: true } },
        responsibleUser: { select: { name: true } },
      },
      orderBy: [{ inventoryNumber: "asc" }],
    });

    const lines = [
      CSV_HEADERS.join(";"),
      ...rows.map((r) =>
        [
          cell(r.inventoryNumber),
          cell(r.serialNumber),
          cell(r.udiDi),
          cell(r.model?.manufacturer),
          cell(r.model?.modelName),
          cell(r.model?.tradeName),
          cell(r.area?.site?.name),
          cell(r.area?.name),
          cell(r.room),
          cell(r.responsibleUser?.name ?? r.responsiblePerson),
          cell(r.commissionedAt?.toISOString().slice(0, 10)),
          cell(r.state),
          cell(r.productKindCode),
        ].join(";"),
      ),
    ];

    const text = `\uFEFF${lines.join("\r\n")}\r\n`;
    const body = Buffer.from(text, "utf8");
    const sha256 = createHash("sha256").update(body).digest("hex");
    const rowCount = rows.length;
    const filterJson = JSON.stringify({
      siteId: filters.siteId ?? null,
      areaId: filters.areaId ?? null,
    });

    const log = await prisma.exportLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        format: "csv",
        filters: filterJson,
        rowCount,
        sha256,
      },
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "inventory_export",
      resourceId: log.id,
      action: "export",
      summary: `§14 CSV export (${rowCount} rows)`,
      after: { format: "csv", rowCount, sha256, filters: filterJson },
    });

    const date = new Date().toISOString().slice(0, 10);
    return {
      body,
      filename: `Bestandsverzeichnis_${date}.csv`,
      rowCount,
      sha256,
    };
  },

  async listRecent(ctx: TenantWorkContext, limit = 5) {
    requirePermission(ctx, "inventory:export");
    const rows = await prisma.exportLog.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 20),
      include: { user: { select: { name: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      format: r.format,
      rowCount: r.rowCount,
      sha256: r.sha256,
      createdAt: r.createdAt.toISOString(),
      userName: r.user.name,
      filters: r.filters,
    }));
  },
};
