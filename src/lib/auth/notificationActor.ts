/**
 * Personal inbox actor (E107) — clinic tenant session or partner org session.
 * Partner does not need X-Acting-Tenant-Id (inbox is per user).
 */
import type { PartnerSessionUser } from "@/interfaces";
import { unauthorized } from "@/lib/errors";
import { readSession } from "@/lib/auth/session";
import {
  requirePartnerContext,
  requireTenantContext,
  withTenantStore,
} from "@/lib/auth/tenantContext";

export type NotificationDoor = "clinic" | "partner";

export type NotificationActor = {
  door: NotificationDoor;
  userId: string;
  correlationId: string;
  /** Clinic only — used for feature-flag gate. */
  tenantId: string | null;
  organisationId: string | null;
  partnerUser: PartnerSessionUser | null;
};

export async function requireNotificationActor(req: Request): Promise<NotificationActor> {
  const user = await readSession();
  if (!user) throw unauthorized();

  if (user.accountKind === "partner") {
    const partner = await requirePartnerContext(req);
    return {
      door: "partner",
      userId: partner.user.id,
      correlationId: partner.correlationId,
      tenantId: null,
      organisationId: partner.organisationId,
      partnerUser: partner.user,
    };
  }

  const clinic = await requireTenantContext(req);
  return {
    door: "clinic",
    userId: clinic.user.id,
    correlationId: clinic.correlationId,
    tenantId: clinic.tenantId,
    organisationId: null,
    partnerUser: null,
  };
}

/** Partner inbox skips tenant store; clinic inbox stays under SEC-01 tenant ALS. */
export async function withNotificationActorStore<T>(
  req: Request,
  fn: (actor: NotificationActor) => Promise<T>,
): Promise<T> {
  const actor = await requireNotificationActor(req);
  if (actor.door === "partner" || !actor.tenantId) {
    return fn(actor);
  }
  return withTenantStore({ tenantId: actor.tenantId }, () => fn(actor));
}
