import type { TenantWorkContext } from "@/interfaces";

/**
 * Frozen display name + optional User FK for legally relevant actions.
 * Spec: FK binds the account; name survives rename/deletion (InspectionRun pattern).
 * Accepts clinic TenantContext or partner ActingContext.
 */
export function actorAttribution(ctx: TenantWorkContext): {
  userId: string;
  name: string;
} {
  return {
    userId: ctx.user.id,
    name: ctx.user.name?.trim() || ctx.user.id,
  };
}

/** recordedBy (name) + recordedByUserId for append-only operational rows. */
export function recordedByAttribution(ctx: TenantWorkContext): {
  recordedBy: string;
  recordedByUserId: string;
} {
  const a = actorAttribution(ctx);
  return { recordedBy: a.name, recordedByUserId: a.userId };
}

/** performedBy (name) + performedByUserId for DutyPerformance rows. */
export function performedByAttribution(ctx: TenantWorkContext): {
  performedBy: string;
  performedByUserId: string;
} {
  const a = actorAttribution(ctx);
  return { performedBy: a.name, performedByUserId: a.userId };
}
