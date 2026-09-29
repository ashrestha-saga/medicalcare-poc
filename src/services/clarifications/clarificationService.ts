import type {
  ClarificationItemDTO,
  ClarificationsResponse,
  ClarificationSummaryDTO,
  TenantWorkContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { evaluateClarificationIssues, maxSeverity } from "@/lib/clarifications/rules";
import { notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

function buildSummary(items: ClarificationItemDTO[]): ClarificationSummaryDTO {
  return {
    openCases: items.length,
    duplicates: items.filter((i) => i.issues.some((x) => x.code === "duplicate_serial")).length,
    derivedClassification: items.filter((i) =>
      i.issues.some((x) => x.code === "derived_classification"),
    ).length,
    missingResponsible: items.filter((i) =>
      i.issues.some((x) => x.code === "missing_responsible"),
    ).length,
  };
}

/**
 * Tenant inventory data-quality list for superadmin / device_admin.
 * Unions computed inventory issues with open DeviceClarification rows (C3).
 */
export const clarificationService = {
  async list(ctx: TenantWorkContext): Promise<ClarificationsResponse> {
    requirePermission(ctx, "clarifications:view");

    const rows = await prisma.deviceInstance.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        model: {
          include: {
            classifications: { where: { validTo: null }, orderBy: { validFrom: "desc" }, take: 1 },
          },
        },
        area: { include: { site: true } },
        responsibleUser: { select: { id: true, name: true } },
        clarifications: { where: { resolvedAt: null } },
      },
      orderBy: [{ inventoryNumber: "asc" }],
    });

    const serialBuckets = new Map<string, string[]>();
    for (const row of rows) {
      const serial = row.serialNumber?.trim();
      if (!serial) continue;
      const key = `${row.modelId ?? ""}::${serial.toLowerCase()}`;
      const list = serialBuckets.get(key) ?? [];
      list.push(row.inventoryNumber);
      serialBuckets.set(key, list);
    }

    const items: ClarificationItemDTO[] = [];

    for (const row of rows) {
      const serial = row.serialNumber?.trim() ?? null;
      const serialKey = serial ? `${row.modelId ?? ""}::${serial.toLowerCase()}` : null;
      const bucket = serialKey ? serialBuckets.get(serialKey) ?? [] : [];
      const duplicatePeers =
        serial && bucket.length > 1
          ? bucket.filter((inv) => inv !== row.inventoryNumber)
          : [];

      const cls = row.model?.classifications[0] ?? null;
      const issues = evaluateClarificationIssues({
        responsibleUserId: row.responsibleUserId,
        responsiblePerson: row.responsibleUser?.name ?? row.responsiblePerson,
        maintenanceCycleMonths: row.maintenanceCycleMonths,
        room: row.room,
        serialNumber: row.serialNumber,
        modelName: row.model?.modelName ?? null,
        tradeName: row.model?.tradeName ?? null,
        state: row.state,
        classificationConfidence: cls?.confidence ?? null,
        hasModelClassification: Boolean(cls),
        duplicateSerialInventoryNumbers: duplicatePeers,
      });

      for (const c of row.clarifications) {
        issues.push({
          code: c.kind === "duplicate" ? "duplicate_serial" : "derived_classification",
          label: `${c.label} (deferred by ${c.deferredBy})`,
          severity: c.kind === "evidence" ? "high" : "medium",
        });
      }

      if (issues.length === 0) continue;

      const locationParts = [row.area?.site?.name, row.area?.name, row.room].filter(Boolean);
      const title =
        row.model?.tradeName?.trim() ||
        row.model?.modelName?.trim() ||
        row.inventoryNumber;

      items.push({
        deviceId: row.id,
        inventoryNumber: row.inventoryNumber,
        title,
        locationText: locationParts.length ? locationParts.join(" · ") : null,
        serialNumber: row.serialNumber,
        modelId: row.modelId,
        issues,
        severity: maxSeverity(issues),
        reasonText: issues.map((i) => i.label).join(" · "),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        sourceLabel: row.model?.source ?? null,
        deferredClarifications: row.clarifications.map((c) => ({
          id: c.id,
          kind: c.kind,
          field: c.field,
          label: c.label,
          deferredBy: c.deferredBy,
          deferredAt: c.deferredAt.toISOString(),
        })),
      });
    }

    items.sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      const d = rank[a.severity] - rank[b.severity];
      if (d !== 0) return d;
      return a.inventoryNumber.localeCompare(b.inventoryNumber);
    });

    return { summary: buildSummary(items), items };
  },

  async resolve(
    ctx: TenantWorkContext,
    clarificationId: string,
    input?: { note?: string | null },
  ) {
    requirePermission(ctx, "clarifications:view");
    // Resolving needs inventory update rights in practice; reuse clarifications:view + check admin.
    requirePermission(ctx, "inventory:update");

    const row = await prisma.deviceClarification.findFirst({
      where: { id: clarificationId, tenantId: ctx.tenantId },
    });
    if (!row) throw notFound("Clarification not found.");
    if (row.resolvedAt) throw unprocessable("Already resolved.");

    const updated = await prisma.deviceClarification.update({
      where: { id: row.id },
      data: {
        resolvedBy: ctx.user.name,
        resolvedAt: new Date(),
        resolutionNote: input?.note?.trim() || null,
      },
    });

    return {
      id: updated.id,
      resolvedBy: updated.resolvedBy,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      resolutionNote: updated.resolutionNote,
    };
  },
};
