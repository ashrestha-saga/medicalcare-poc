import type {
  ClarificationItemDTO,
  ClarificationsResponse,
  ClarificationSummaryDTO,
  TenantContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { evaluateClarificationIssues, maxSeverity } from "@/lib/clarifications/rules";
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
 */
export const clarificationService = {
  async list(ctx: TenantContext): Promise<ClarificationsResponse> {
    requirePermission(ctx, "clarifications:view");

    const rows = await prisma.deviceInstance.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        model: {
          include: {
            classificationProposals: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        area: { include: { site: true } },
        responsibleUser: { select: { id: true, name: true } },
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

      const proposal = row.model?.classificationProposals[0] ?? null;
      const issues = evaluateClarificationIssues({
        responsibleUserId: row.responsibleUserId,
        responsiblePerson: row.responsibleUser?.name ?? row.responsiblePerson,
        maintenanceCycleMonths: row.maintenanceCycleMonths,
        room: row.room,
        serialNumber: row.serialNumber,
        modelName: row.model?.modelName ?? null,
        tradeName: row.model?.tradeName ?? null,
        classificationConfidence: proposal?.confidence ?? null,
        hasClassificationProposal: Boolean(proposal),
        duplicateSerialInventoryNumbers: duplicatePeers,
      });

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
      });
    }

    // High severity first, then inventory number.
    items.sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      const d = rank[a.severity] - rank[b.severity];
      if (d !== 0) return d;
      return a.inventoryNumber.localeCompare(b.inventoryNumber);
    });

    return { summary: buildSummary(items), items };
  },
};
