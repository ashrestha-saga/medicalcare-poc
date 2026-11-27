import type {
  ClarificationIssueCode,
  ClarificationItemDTO,
  ClarificationsResponse,
  ClarificationSummaryDTO,
  TenantWorkContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { evaluateClarificationIssues, maxSeverity } from "@/lib/clarifications/rules";
import { notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/** Label / type from Betriebsmittel characteristics when no catalog model exists. */
function equipmentLabelFromCharacteristics(json: string | null | undefined): {
  tradeName: string | null;
  modelName: string | null;
} {
  if (!json?.trim()) return { tradeName: null, modelName: null };
  try {
    const c = JSON.parse(json) as { tradeName?: unknown; modelName?: unknown; label?: unknown };
    const trade =
      (typeof c.tradeName === "string" && c.tradeName.trim()) ||
      (typeof c.label === "string" && c.label.trim()) ||
      null;
    const model = typeof c.modelName === "string" && c.modelName.trim() ? c.modelName.trim() : null;
    return { tradeName: trade, modelName: model };
  } catch {
    return { tradeName: null, modelName: null };
  }
}

function buildSummary(items: ClarificationItemDTO[]): ClarificationSummaryDTO {
  return {
    openCases: items.length,
    duplicates: items.filter((i) => i.issues.some((x) => x.code === "duplicate_serial")).length,
    derivedClassification: items.filter((i) =>
      i.issues.some((x) => x.code === "derived_classification"),
    ).length,
    importReview: items.filter((i) => i.issues.some((x) => x.code === "import_review")).length,
    missingResponsible: items.filter((i) =>
      i.issues.some((x) => x.code === "missing_responsible"),
    ).length,
  };
}

function issueCodeFromClarificationKind(kind: string): ClarificationIssueCode {
  if (kind === "duplicate") return "duplicate_serial";
  if (kind === "import_review") return "import_review";
  if (kind === "classification" || kind === "missing_classification") {
    return "missing_classification";
  }
  // Legacy / generic deferred rows — keep prior mapping for evidence etc.
  return "derived_classification";
}

/**
 * Same predicate as the Klärliste UI: inventory issues ∪ open DeviceClarification rows.
 * Tenant scoping comes from the Prisma tenant extension / caller context.
 */
async function collectOpenItems(): Promise<ClarificationItemDTO[]> {
  const rows = await prisma.deviceInstance.findMany({
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
    const bucket = serialKey ? (serialBuckets.get(serialKey) ?? []) : [];
    const duplicatePeers =
      serial && bucket.length > 1 ? bucket.filter((inv) => inv !== row.inventoryNumber) : [];

    const cls = row.model?.classifications[0] ?? null;
    const isEquipment = row.kind === "equipment";
    const equipNames = isEquipment
      ? equipmentLabelFromCharacteristics(row.characteristicsJson)
      : { tradeName: null, modelName: null };
    const issues = evaluateClarificationIssues({
      kind: row.kind === "equipment" ? "equipment" : "mp",
      responsibleUserId: row.responsibleUserId,
      responsiblePerson: row.responsibleUser?.name ?? row.responsiblePerson,
      maintenanceCycleMonths: row.maintenanceCycleMonths,
      room: row.room,
      serialNumber: row.serialNumber,
      modelName: row.model?.modelName ?? equipNames.modelName,
      tradeName: row.model?.tradeName ?? equipNames.tradeName,
      state: row.state,
      classificationConfidence: cls?.confidence ?? null,
      hasModelClassification: Boolean(cls),
      duplicateSerialInventoryNumbers: duplicatePeers,
    });

    for (const c of row.clarifications) {
      // Deferred MP classification / UDI clarifications do not apply to Betriebsmittel.
      if (isEquipment && c.kind !== "duplicate" && c.kind !== "import_review") continue;
      const code = issueCodeFromClarificationKind(c.kind);
      issues.push({
        code,
        label: `${c.label} (deferred by ${c.deferredBy})`,
        severity: c.kind === "evidence" ? "high" : c.kind === "import_review" ? "medium" : "medium",
      });
    }

    if (issues.length === 0) continue;

    const locationParts = [row.area?.site?.name, row.area?.name, row.room].filter(Boolean);
    const title =
      row.model?.tradeName?.trim() ||
      row.model?.modelName?.trim() ||
      equipNames.tradeName ||
      equipNames.modelName ||
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

  return items;
}

/**
 * Tenant inventory data-quality list for superadmin / device_admin.
 * Unions computed inventory issues with open DeviceClarification rows (C3).
 */
export const clarificationService = {
  async list(ctx: TenantWorkContext): Promise<ClarificationsResponse> {
    requirePermission(ctx, "clarifications:view");
    const items = await collectOpenItems();
    return { summary: buildSummary(items), items };
  },

  /** Dashboard tile count — same open-case set as {@link list}. */
  async countOpenCases(_ctx: TenantWorkContext): Promise<number> {
    const items = await collectOpenItems();
    return items.length;
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
