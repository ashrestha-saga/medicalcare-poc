import type { QuoteDecision, ServiceRequestState } from "@prisma/client";
import type { ActingContext, TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import {
  requireActingPartnerConsolePermission,
  requirePermission,
} from "@/lib/auth/tenantContext";
import { conflict, forbidden, notFound, unprocessable } from "@/lib/errors";
import { normalizeEuroText } from "@/lib/euro";
import { isRepairsEnabled } from "@/lib/features/repairs";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";

async function assertClinicRepairs(ctx: { tenantId: string }) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { featureFlags: true },
  });
  if (!isRepairsEnabled(tenant?.featureFlags)) {
    throw forbidden("Repairs feature is not enabled for this tenant");
  }
}

function reopenStateAfterQuoteReject(sr: {
  state: ServiceRequestState;
  scheduledAt: Date | null;
  transmittedAt: Date | null;
}): ServiceRequestState | null {
  if (sr.state !== "rejected") return null;
  if (sr.scheduledAt) return "scheduled";
  if (sr.transmittedAt) return "transmitted";
  return "queued";
}

/** R10 — partner (acting) creates/updates quote (amount as text). */
export async function upsertQuote(
  ctx: ActingContext,
  serviceRequestId: string,
  input: { scopeText: string; amountText: string },
) {
  requireActingPartnerConsolePermission(ctx, "console:disposition:assign");
  await assertClinicRepairs(ctx);
  const scopeText = input.scopeText.trim();
  const amountText = normalizeEuroText(input.amountText);
  if (!scopeText || !amountText) {
    throw unprocessable("scopeText and a valid euro amountText are required");
  }

  const sr = await prisma.serviceRequest.findFirst({
    where: { id: serviceRequestId, tenantId: ctx.tenantId },
    select: {
      id: true,
      reference: true,
      state: true,
      scheduledAt: true,
      transmittedAt: true,
    },
  });
  if (!sr) throw notFound("Service request not found");

  const existing = await prisma.quote.findFirst({
    where: { serviceRequestId: sr.id, tenantId: ctx.tenantId },
  });

  const contentChanged =
    !existing ||
    existing.scopeText !== scopeText ||
    existing.amountText !== amountText;

  if (existing && !contentChanged) {
    return existing;
  }

  const reopenDecision = !existing || contentChanged;
  const wasDecided = existing != null && existing.decision !== "open";

  const row = existing
    ? await prisma.quote.update({
        where: { id: existing.id },
        data: {
          scopeText,
          amountText,
          ...(reopenDecision
            ? {
                decision: "open" as const,
                decidedBy: null,
                decidedByUserId: null,
                decidedAt: null,
                decisionNote: null,
              }
            : {}),
        },
      })
    : await prisma.quote.create({
        data: {
          tenantId: ctx.tenantId,
          serviceRequestId: sr.id,
          scopeText,
          amountText,
          createdBy: ctx.user.name,
          createdByUserId: ctx.user.id,
          decision: "open",
        },
      });

  const nextSrState = reopenDecision ? reopenStateAfterQuoteReject(sr) : null;
  if (nextSrState) {
    await prisma.serviceRequest.update({
      where: { id: sr.id },
      data: { state: nextSrState },
    });
  }

  const historyState = nextSrState ?? sr.state;
  const historyNote = existing
    ? wasDecided
      ? `Quote updated (${amountText}); decision reset to open for clinic re-approval`
      : `Quote updated (${amountText})`
    : `Quote created (${amountText})`;

  await prisma.statusEvent.create({
    data: {
      tenantId: ctx.tenantId,
      serviceRequestId: sr.id,
      state: historyState,
      source: "console",
      actor: ctx.user.name,
      note: historyNote,
    },
  });

  await recordAudit({
    actor: ctx.actor,
    resource: "Quote",
    resourceId: row.id,
    action: existing ? "update" : "create",
    summary: existing
      ? `Quote updated on ${sr.reference}${wasDecided ? " (reopened)" : ""}`
      : `Quote created on ${sr.reference}`,
    before: existing
      ? {
          amountText: existing.amountText,
          scopeText: existing.scopeText,
          decision: existing.decision,
        }
      : null,
    after: {
      amountText: row.amountText,
      scopeText: row.scopeText,
      decision: row.decision,
      serviceRequestState: historyState,
    },
  });

  return row;
}

/** R10 — clinic approve/reject. */
export async function decideQuote(
  ctx: TenantWorkContext,
  serviceRequestId: string,
  input: { decision: Exclude<QuoteDecision, "open">; decisionNote?: string | null },
) {
  requirePermission(ctx, "requests:approve");
  await assertClinicRepairs(ctx);

  if (input.decision === "rejected" && !input.decisionNote?.trim()) {
    throw unprocessable("Reject requires a note", { field: "decisionNote" });
  }

  const quote = await prisma.quote.findFirst({
    where: { serviceRequestId, tenantId: ctx.tenantId },
  });
  if (!quote) throw notFound("Quote not found");
  if (quote.decision !== "open") throw conflict("Quote already decided");

  const sr = await prisma.serviceRequest.findFirst({
    where: { id: serviceRequestId, tenantId: ctx.tenantId },
    select: { id: true, reference: true, state: true },
  });
  if (!sr) throw notFound("Service request not found");

  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: {
      decision: input.decision,
      decidedBy: ctx.user.name,
      decidedByUserId: ctx.user.id,
      decidedAt: new Date(),
      decisionNote: input.decisionNote?.trim() || null,
    },
  });

  let historyState: ServiceRequestState = sr.state;
  if (input.decision === "rejected") {
    await prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: { state: "rejected" },
    });
    historyState = "rejected";
  }

  await prisma.statusEvent.create({
    data: {
      tenantId: ctx.tenantId,
      serviceRequestId: sr.id,
      state: historyState,
      source: "clinic",
      actor: ctx.user.name,
      note:
        input.decision === "approved"
          ? `Quote approved (${quote.amountText})`
          : `Quote rejected (${quote.amountText})${
              input.decisionNote?.trim() ? `: ${input.decisionNote.trim()}` : ""
            }`,
    },
  });

  await recordAudit({
    actor: actorFromContext(ctx),
    resource: "Quote",
    resourceId: updated.id,
    action: "decide",
    summary: `Quote ${input.decision} on ${sr.reference}`,
    before: { decision: "open" },
    after: { decision: updated.decision, decisionNote: updated.decisionNote },
  });

  return updated;
}
