import type { PartnerContext } from "@/interfaces/session";
import { actorFromPartnerOnTenant } from "@/lib/auth/actorContext";
import { forbidden, unprocessable } from "@/lib/errors";
import { prismaSystem } from "@/lib/prisma";
import { isLiveContract } from "@/services/access/partnerAccessService";
import { parseContractScope } from "@/constants/partnerPermissions";
import { getCachedPartnerConsolePermissions } from "@/services/roles/roleGrantsService";
import { recordAudit } from "@/services/audit/auditService";
import { randomUUID } from "crypto";

export type FieldSafetyRolloutInput = {
  reference: string;
  title: string;
  manufacturer: string;
  requiredAction: string;
  affectedScope?: string;
  /** Model / type used for tenant preview and stored in scope text. */
  modelLabel?: string;
  dueAt?: string | null;
  tenantIds: string[];
};

export type FieldSafetyPreviewInput = {
  modelLabel: string;
  manufacturer?: string;
};

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function noticeStatus(row: {
  closedAt: Date | null;
  deviceActions: { affected: boolean | null; actionTakenAt: Date | null }[];
}): "closed" | "measure" | "reconciliation" {
  if (row.closedAt) return "closed";
  const devices = row.deviceActions;
  if (devices.length === 0) return "reconciliation";
  if (devices.some((d) => d.affected === null)) return "reconciliation";
  if (devices.some((d) => d.affected === true && d.actionTakenAt == null)) return "measure";
  return "reconciliation";
}

/** Contract may receive manufacturer notices (inspection scope, or any live if unscoped). */
function contractAllowsNotice(scopeRaw: string): boolean {
  const scope = parseContractScope(scopeRaw);
  if (scope.length === 0) return true;
  return scope.includes("inspection") || scope.includes("inventory");
}

/**
 * Partner Field Safety fan-out uses `prismaSystem` — Turbopack can duplicate
 * AsyncLocalStorage across chunks so `runWithoutTenantAsync` is not visible to
 * the tenant Prisma extension (SEC-01).
 */
export const fieldSafetyRolloutService = {
  /**
   * Live managed tenants that appear to hold the named model (inventory match).
   * Used by “Check affected tenants” before rollout.
   */
  async preview(ctx: PartnerContext, input: FieldSafetyPreviewInput) {
    const granted = getCachedPartnerConsolePermissions(ctx.user.appRole);
    if (!granted.includes("fieldsafety:rollout")) throw forbidden();
    const model = input.modelLabel.trim();
    if (!model) {
      throw unprocessable("Enter a model / type.", { field: "modelLabel" });
    }

    const now = new Date();
    const contracts = await prismaSystem.serviceContract.findMany({
      where: { organisationId: ctx.organisationId },
      include: {
        tenant: { select: { id: true, name: true, code: true } },
      },
    });
    const live = contracts.filter(
      (c) => isLiveContract(c, now) && contractAllowsNotice(c.scope),
    );
    if (live.length === 0) return { tenants: [] as const, modelLabel: model };

    const tenantIds = live.map((c) => c.tenantId);
    const manufacturer = input.manufacturer?.trim() || "";

    const devices = await prismaSystem.deviceInstance.findMany({
      where: {
        tenantId: { in: tenantIds },
        state: { not: "retired" },
        model: {
          AND: [
            {
              OR: [
                { tradeName: { contains: model } },
                { modelName: { contains: model } },
              ],
            },
            ...(manufacturer ? [{ manufacturer: { contains: manufacturer } }] : []),
          ],
        },
      },
      select: {
        tenantId: true,
        modelId: true,
        model: {
          select: {
            id: true,
            tradeName: true,
            modelName: true,
            manufacturer: true,
          },
        },
      },
      take: 2000,
    });

    const byTenant = new Map<
      string,
      { deviceCount: number; modelId: string | null; modelLabel: string }
    >();
    for (const d of devices) {
      const label = d.model?.tradeName?.trim() || d.model?.modelName?.trim() || model;
      const cur = byTenant.get(d.tenantId) ?? {
        deviceCount: 0,
        modelId: d.modelId,
        modelLabel: label,
      };
      cur.deviceCount += 1;
      if (!cur.modelId && d.modelId) cur.modelId = d.modelId;
      byTenant.set(d.tenantId, cur);
    }

    const tenants = live
      .filter((c) => byTenant.has(c.tenantId))
      .map((c) => {
        const hit = byTenant.get(c.tenantId)!;
        return {
          tenantId: c.tenantId,
          tenantName: c.tenant.name,
          tenantCode: c.tenant.code,
          deviceCount: hit.deviceCount,
          modelId: hit.modelId,
          matchedModelLabel: hit.modelLabel,
        };
      })
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName));

    return { tenants, modelLabel: model };
  },

  async list(ctx: PartnerContext) {
    const granted = getCachedPartnerConsolePermissions(ctx.user.appRole);
    if (!granted.includes("fieldsafety:rollout") && !granted.includes("console:customers:view")) {
      throw forbidden();
    }

    const now = new Date();
    const contracts = await prismaSystem.serviceContract.findMany({
      where: { organisationId: ctx.organisationId },
      select: {
        tenantId: true,
        validFrom: true,
        validTo: true,
        suspendedAt: true,
        terminatedAt: true,
      },
    });
    const liveTenantIds = contracts.filter((c) => isLiveContract(c, now)).map((c) => c.tenantId);

    const rows = await prismaSystem.fieldSafetyAction.findMany({
      where: {
        OR: [
          { sourceOrganisationId: ctx.organisationId },
          ...(liveTenantIds.length > 0 ? [{ tenantId: { in: liveTenantIds } }] : []),
        ],
      },
      include: {
        tenant: { select: { name: true, code: true } },
        deviceActions: { select: { affected: true, actionTakenAt: true } },
        affectedModels: {
          take: 1,
          include: {
            deviceModel: {
              select: { tradeName: true, modelName: true },
            },
          },
        },
      },
      orderBy: { recordedAt: "desc" },
      take: 200,
    });

    const byKey = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.rolloutKey ?? `ref:${row.reference}`;
      const list = byKey.get(key) ?? [];
      list.push(row);
      byKey.set(key, list);
    }

    const flat = rows.map((i) => {
      const am = i.affectedModels[0];
      const modelFromLink =
        am?.deviceModel?.tradeName?.trim() || am?.deviceModel?.modelName?.trim() || null;
      return {
        id: i.id,
        rolloutKey: i.rolloutKey ?? `ref:${i.reference}`,
        reference: i.reference,
        title: i.title,
        manufacturer: i.manufacturer,
        modelLabel: modelFromLink,
        affectedScope: i.affectedScope,
        dueAt: isoDate(i.dueAt),
        recordedAt: isoDate(i.recordedAt) ?? isoDate(i.receivedAt),
        sourceOrganisationId: i.sourceOrganisationId,
        status: noticeStatus(i),
        tenantId: i.tenantId,
        tenantName: i.tenant.name,
        tenantCode: i.tenant.code,
        closedAt: isoDate(i.closedAt),
      };
    });

    return {
      rows: flat,
      groups: [...byKey.entries()].map(([rolloutKey, items]) => ({
        rolloutKey,
        reference: items[0]?.reference ?? "",
        title: items[0]?.title ?? "",
        manufacturer: items[0]?.manufacturer ?? "",
        dueAt: isoDate(items[0]?.dueAt),
        sourceOrganisationId: items[0]?.sourceOrganisationId ?? null,
        tenants: items.map((i) => ({
          tenantId: i.tenantId,
          tenantName: i.tenant.name,
          tenantCode: i.tenant.code,
          id: i.id,
          closedAt: isoDate(i.closedAt),
          status: noticeStatus(i),
        })),
      })),
    };
  },

  async rollout(ctx: PartnerContext, input: FieldSafetyRolloutInput) {
    const granted = getCachedPartnerConsolePermissions(ctx.user.appRole);
    if (!granted.includes("fieldsafety:rollout")) throw forbidden();
    if (!input.tenantIds.length) {
      throw unprocessable("Select at least one tenant.", { field: "tenantIds" });
    }

    const now = new Date();
    const contracts = await prismaSystem.serviceContract.findMany({
      where: {
        organisationId: ctx.organisationId,
        tenantId: { in: input.tenantIds },
      },
    });
    const live = contracts.filter((c) => isLiveContract(c, now));
    if (live.length === 0) {
      throw unprocessable("No live contracts for the selected tenants.");
    }

    const modelLabel = input.modelLabel?.trim() || "";
    let resolvedModelId: string | null = null;
    if (modelLabel) {
      const hit = await prismaSystem.deviceModel.findFirst({
        where: {
          OR: [
            { tradeName: { contains: modelLabel } },
            { modelName: { contains: modelLabel } },
          ],
          ...(input.manufacturer.trim()
            ? { manufacturer: { contains: input.manufacturer.trim() } }
            : {}),
        },
        select: { id: true },
      });
      resolvedModelId = hit?.id ?? null;
    }

    const scopeParts = [
      input.affectedScope?.trim(),
      modelLabel ? `Model: ${modelLabel}` : null,
    ].filter(Boolean);
    const affectedScope = scopeParts.join(" · ") || "See manufacturer letter";

    const rolloutKey = randomUUID();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let created = 0;
    for (const contract of live) {
      const existing = await prismaSystem.fieldSafetyAction.findUnique({
        where: {
          tenantId_reference: { tenantId: contract.tenantId, reference: input.reference },
        },
      });
      if (existing) {
        await prismaSystem.fieldSafetyAction.update({
          where: { id: existing.id },
          data: {
            rolloutKey,
            sourceOrganisationId: ctx.organisationId,
            title: input.title,
            manufacturer: input.manufacturer,
            requiredAction: input.requiredAction,
            affectedScope,
            dueAt: input.dueAt ? new Date(input.dueAt) : existing.dueAt,
          },
        });
        if (resolvedModelId || modelLabel) {
          const hasModel = await prismaSystem.fieldSafetyAffectedModel.count({
            where: { fieldSafetyActionId: existing.id },
          });
          if (hasModel === 0) {
            await prismaSystem.fieldSafetyAffectedModel.create({
              data: {
                tenantId: contract.tenantId,
                fieldSafetyActionId: existing.id,
                deviceModelId: resolvedModelId,
                note: modelLabel || null,
              },
            });
          }
        }
        created += 1;
        continue;
      }
      const row = await prismaSystem.fieldSafetyAction.create({
        data: {
          tenantId: contract.tenantId,
          reference: input.reference,
          title: input.title,
          manufacturer: input.manufacturer,
          requiredAction: input.requiredAction,
          affectedScope,
          issuedAt: today,
          receivedAt: today,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          recordedBy: ctx.user.name,
          recordedByUserId: ctx.user.id,
          rolloutKey,
          sourceOrganisationId: ctx.organisationId,
          affectedModels:
            resolvedModelId || modelLabel
              ? {
                  create: {
                    tenantId: contract.tenantId,
                    deviceModelId: resolvedModelId,
                    note: modelLabel || null,
                  },
                }
              : undefined,
        },
      });
      created += 1;
      await recordAudit({
        actor: actorFromPartnerOnTenant(ctx, contract.tenantId, contract.id),
        resource: "field_safety",
        resourceId: row.id,
        action: "create",
        summary: `FSCA rollout ${input.reference} → tenant`,
        after: { rolloutKey, reference: input.reference, modelLabel: modelLabel || null },
      });
    }
    return { rolloutKey, created };
  },
};
