import type { ActingContext, TenantContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import {
  requireActingPartnerConsolePermission,
  requirePermission,
} from "@/lib/auth/tenantContext";
import { conflict, forbidden, notFound, unprocessable } from "@/lib/errors";
import { isRepairsEnabled } from "@/lib/features/repairs";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";

async function assertRepairsTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true },
  });
  if (!isRepairsEnabled(tenant?.featureFlags)) {
    throw forbidden("Repairs feature is not enabled for this tenant");
  }
}

/** R15 — confirm a proposed follow-up. */
export async function confirmProposal(ctx: ActingContext | TenantContext, requestId: string) {
  if (ctx.user.accountKind === "partner") {
    requireActingPartnerConsolePermission(ctx as ActingContext, "console:disposition:assign");
  } else {
    requirePermission(ctx as TenantContext, "requests:approve");
  }
  await assertRepairsTenant(ctx.tenantId);

  const sr = await prisma.serviceRequest.findFirst({
    where: { id: requestId, tenantId: ctx.tenantId },
  });
  if (!sr) throw notFound("Service request not found");
  if (sr.proposalState !== "proposed") throw conflict("Not a proposed follow-up");

  const updated = await prisma.serviceRequest.update({
    where: { id: sr.id },
    data: { proposalState: "confirmed" },
  });

  await recordAudit({
    actor: actorFromContext(ctx as ActingContext),
    resource: "ServiceRequest",
    resourceId: sr.reference,
    action: "confirm_proposal",
    summary: `Confirmed proposal ${sr.reference}`,
  });

  return updated;
}

/** R15 — discard a proposed follow-up (not allowed when mandatory). */
export async function discardProposal(
  ctx: ActingContext | TenantContext,
  requestId: string,
  note: string,
) {
  if (ctx.user.accountKind === "partner") {
    requireActingPartnerConsolePermission(ctx as ActingContext, "console:disposition:assign");
  } else {
    requirePermission(ctx as TenantContext, "requests:approve");
  }
  await assertRepairsTenant(ctx.tenantId);

  if (!note.trim()) throw unprocessable("Discard requires a note", { field: "note" });

  const sr = await prisma.serviceRequest.findFirst({
    where: { id: requestId, tenantId: ctx.tenantId },
  });
  if (!sr) throw notFound("Service request not found");
  if (sr.mandatory) throw conflict("Mandatory follow-ups cannot be discarded", { code: "MANDATORY" });
  if (sr.proposalState !== "proposed") throw conflict("Not a proposed follow-up");

  const updated = await prisma.serviceRequest.update({
    where: { id: sr.id },
    data: {
      proposalState: "discarded",
      state: "rejected",
      note: [sr.note, `Discarded: ${note.trim()}`].filter(Boolean).join("\n"),
    },
  });

  await recordAudit({
    actor: actorFromContext(ctx as ActingContext),
    resource: "ServiceRequest",
    resourceId: sr.reference,
    action: "discard_proposal",
    summary: `Discarded proposal ${sr.reference}`,
    after: { note },
  });

  return updated;
}
