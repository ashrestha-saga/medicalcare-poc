import type { ActorContext, RequestMeta } from "@/interfaces/audit";
import type { ActingContext, ClinicSessionUser, PartnerContext, TenantWorkContext } from "@/interfaces/session";

type ClinicActorSource = {
  tenantId: string;
  user: ClinicSessionUser;
  correlationId: string;
  requestMeta?: RequestMeta;
  actor?: ActorContext;
};

export function requestMetaFrom(req?: Request | null): RequestMeta {
  if (!req) return { ip: null, userAgent: null };
  const forwarded = req.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    null;
  const userAgent = req.headers.get("user-agent");
  return { ip: ip || null, userAgent: userAgent || null };
}

export function actorFromTenant(ctx: ClinicActorSource, req?: Request | null): ActorContext {
  const meta = ctx.requestMeta ?? requestMetaFrom(req);
  return {
    tenantId: ctx.tenantId,
    actorUserId: ctx.user.id,
    actorKind: "clinic",
    actorRole: ctx.user.role,
    actorName: ctx.user.name,
    organisationId: null,
    organisationName: null,
    serviceContractId: null,
    correlationId: ctx.correlationId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  };
}

/** Partner acting on a contracted clinic — snapshot used by recordAudit. */
export function actorFromPartnerOnTenant(
  ctx: PartnerContext,
  tenantId: string,
  contractId: string | null,
  req?: Request | null,
): ActorContext {
  const meta = requestMetaFrom(req);
  return {
    tenantId,
    actorUserId: ctx.user.id,
    actorKind: "partner",
    actorRole: String(ctx.user.appRole),
    actorName: ctx.user.name,
    organisationId: ctx.organisationId,
    organisationName: ctx.user.organisationName,
    serviceContractId: contractId,
    correlationId: ctx.correlationId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  };
}

/** Partner organisation console — no clinic tenant; used for org-scoped audit. */
export function actorFromPartnerOrg(ctx: PartnerContext, req?: Request | null): ActorContext {
  const meta = ctx.requestMeta ?? requestMetaFrom(req);
  return {
    tenantId: null,
    actorUserId: ctx.user.id,
    actorKind: "partner",
    actorRole: String(ctx.user.appRole),
    actorName: ctx.user.name,
    organisationId: ctx.organisationId,
    organisationName: ctx.user.organisationName,
    serviceContractId: null,
    correlationId: ctx.correlationId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  };
}

/** Prefer the gate-built actor so partner writes cannot look like clinic actions. */
export function actorFromContext(ctx: TenantWorkContext | ActingContext | ClinicActorSource): ActorContext {
  if ("actor" in ctx && ctx.actor) return ctx.actor;
  return actorFromTenant(ctx as ClinicActorSource);
}

export function actorSystem(args: {
  tenantId: string | null;
  source?: string;
  correlationId?: string | null;
  req?: Request | null;
}): ActorContext {
  const meta = requestMetaFrom(args.req);
  return {
    tenantId: args.tenantId,
    actorUserId: null,
    actorKind: "system",
    actorRole: args.source ?? "system",
    actorName: args.source ?? "system",
    organisationId: null,
    organisationName: null,
    serviceContractId: null,
    correlationId: args.correlationId ?? null,
    ip: meta.ip,
    userAgent: meta.userAgent,
  };
}
