import type {
  DispatchChannelSettingsDTO,
  DispatchTargetsSettingsDTO,
  TenantWorkContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  ensureDefaultMailTarget,
  ensureInternalExecutor,
} from "@/services/contracts/executorSyncService";

export const dispatchTargetsSettingsService = {
  /**
   * List executors + channels. Ensures O-INT and a default mail target per executor
   * so Settings always has toggles (incl. after contract backfill without seed targets).
   */
  async list(ctx: TenantWorkContext): Promise<DispatchTargetsSettingsDTO> {
    requirePermission(ctx, "settings:view");
    const canManage = Boolean(ctx.permissions?.includes("settings:smtp"));

    await ensureInternalExecutor(prisma, ctx.tenantId);

    const executors = await prisma.executorOrg.findMany({
      where: { tenantId: ctx.tenantId, active: true },
      orderBy: { sortOrder: "asc" },
      include: {
        organisation: { select: { contact: true } },
        dispatchTargets: {
          orderBy: [{ type: "asc" }, { name: "asc" }],
        },
      },
    });

    for (const ex of executors) {
      if (ex.dispatchTargets.some((t) => t.type === "mail")) continue;
      await ensureDefaultMailTarget(prisma, {
        tenantId: ctx.tenantId,
        executorOrgId: ex.id,
        executorName: ex.name,
        endpoint: ex.organisation?.contact ?? null,
      });
    }

    const refreshed = await prisma.executorOrg.findMany({
      where: { tenantId: ctx.tenantId, active: true },
      orderBy: { sortOrder: "asc" },
      include: {
        dispatchTargets: {
          orderBy: [{ type: "asc" }, { name: "asc" }],
        },
      },
    });

    return {
      canManage,
      executors: refreshed.map((ex) => ({
        id: ex.id,
        code: ex.code,
        name: ex.name,
        kind: ex.kind,
        channels: ex.dispatchTargets.map((t) => ({
          id: t.id,
          type: t.type,
          name: t.name,
          endpoint: t.endpoint,
          enabled: t.enabled,
        })),
      })),
    };
  },

  async setEnabled(
    ctx: TenantWorkContext,
    targetId: string,
    enabled: boolean,
  ): Promise<DispatchChannelSettingsDTO> {
    requirePermission(ctx, "settings:smtp");

    const row = await prisma.dispatchTarget.findFirst({
      where: { id: targetId, tenantId: ctx.tenantId },
    });
    if (!row) throw notFound("Dispatch channel not found.");
    if (!row.executorOrgId) {
      throw unprocessable("Channel is not linked to an executor.", { field: "targetId" });
    }

    const updated = await prisma.dispatchTarget.update({
      where: { id: row.id },
      data: { enabled },
    });

    return {
      id: updated.id,
      type: updated.type,
      name: updated.name,
      endpoint: updated.endpoint,
      enabled: updated.enabled,
    };
  },
};
