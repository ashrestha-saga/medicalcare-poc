import type { TenantContext } from "@/interfaces";

/**
 * Frozen display name + optional User FK for legally relevant actions.
 * Spec: FK binds the account; name survives rename/deletion (InspectionRun pattern).
 */
export function actorAttribution(ctx: TenantContext): {
  userId: string;
  name: string;
} {
  return {
    userId: ctx.user.id,
    name: ctx.user.name?.trim() || ctx.user.id,
  };
}

/** recordedBy (name) + recordedByUserId for append-only operational rows. */
export function recordedByAttribution(ctx: TenantContext): {
  recordedBy: string;
  recordedByUserId: string;
} {
  const a = actorAttribution(ctx);
  return { recordedBy: a.name, recordedByUserId: a.userId };
}
