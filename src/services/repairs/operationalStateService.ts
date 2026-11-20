import type { LockSource, OperationalState, Prisma } from "@prisma/client";
import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { conflict, forbidden, notFound, unprocessable } from "@/lib/errors";
import { isRepairsEnabled } from "@/lib/features/repairs";
import { isRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";

/** Full acting/clinic ctx, or minimal system-driven ctx (repair outcomes pass `system` + `tx`). */
type TransitionCtx =
  | TenantWorkContext
  | {
      tenantId: string;
      user: { id: string; name: string; role?: string };
      correlationId: string;
    };

/** Pure transition table (R13) — exported for unit tests. */
export const OPERATIONAL_STATE_TRANSITIONS: Record<OperationalState, OperationalState[]> = {
  in_service: ["locked", "under_repair", "replaced", "loaner"],
  locked: ["in_service", "under_repair", "replaced"],
  under_repair: ["locked", "in_service", "replaced"],
  replaced: ["in_service", "under_repair"],
  loaner: ["in_service"],
};

export function canTransitionOperationalState(
  from: OperationalState,
  to: OperationalState,
): boolean {
  if (from === to) return true;
  return OPERATIONAL_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

async function assertRepairs(ctx: TransitionCtx) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  // E88 constancy lock (rso) also uses this transition table under radiation_dguv.
  if (
    !isRepairsEnabled(tenant?.featureFlags) &&
    !isRadiationDguvEnabled(tenant?.featureFlags)
  ) {
    throw forbidden("Repairs feature is not enabled for this tenant");
  }
}

export async function transitionOperationalState(
  ctx: TransitionCtx,
  input: {
    deviceInstanceId: string;
    to: OperationalState;
    lockSource?: LockSource | null;
    note?: string | null;
    /** Clinic unlock requires inventory:update (R13). */
    unlock?: boolean;
    /** Rule-driven transitions (R12) skip the clinic unlock permission. */
    system?: boolean;
    tx?: Prisma.TransactionClient;
  },
): Promise<{ from: OperationalState; to: OperationalState }> {
  await assertRepairs(ctx);
  const db = input.tx ?? prisma;

  const device = await db.deviceInstance.findFirst({
    where: { id: input.deviceInstanceId },
    select: {
      id: true,
      inventoryNumber: true,
      operationalState: true,
      lockSource: true,
    },
  });
  if (!device) throw notFound("Device not found");

  const from = device.operationalState;
  const to = input.to;
  if (from === to) return { from, to };

  if (!input.system && (input.unlock || (from === "locked" && to === "in_service"))) {
    requirePermission(ctx as TenantWorkContext, "inventory:update");
  }

  if (!canTransitionOperationalState(from, to)) {
    throw conflict(`Cannot transition operational state ${from} → ${to}`);
  }

  const data: Prisma.DeviceInstanceUpdateInput = {
    operationalState: to,
  };
  if (to === "locked" || to === "under_repair") {
    data.lockSource = input.lockSource ?? device.lockSource ?? "user";
  }
  if (to === "in_service") {
    data.lockSource = null;
    data.lockClearedAt = new Date();
    data.lockClearedBy = ctx.user.name;
    data.lockClearedNote = input.note?.trim() || null;
    data.lockedAt = null;
    data.lockReason = null;
    data.lockedByRunId = null;
  }

  await db.deviceInstance.update({ where: { id: device.id }, data });
  await db.deviceUnitEvent.create({
    data: {
      tenantId: ctx.tenantId,
      deviceInstanceId: device.id,
      actor: ctx.user.name,
      action: "operational_state",
      fromState: from,
      toState: to,
      note: input.note?.trim() || null,
    },
  });

  if (!input.tx) {
    await recordAudit({
      actor: actorFromContext(ctx as TenantWorkContext),
      resource: "DeviceInstance",
      resourceId: device.id,
      action: "operational_state",
      summary: `${device.inventoryNumber}: ${from} → ${to}`,
      after: { from, to, note: input.note ?? null },
    });
  }

  return { from, to };
}

export const operationalStateService = {
  async unlock(
    ctx: TenantWorkContext,
    deviceInstanceId: string,
    note: string,
  ): Promise<{ from: OperationalState; to: OperationalState }> {
    requirePermission(ctx, "inventory:update");
    if (!note.trim()) throw unprocessable("Unlock requires a reason", { field: "note" });
    return transitionOperationalState(ctx, {
      deviceInstanceId,
      to: "in_service",
      note,
      unlock: true,
    });
  },
};
