import type { ActingContext } from "@/interfaces";
import { requireActingPartnerConsolePermission } from "@/lib/auth/tenantContext";
import { conflict, forbidden, notFound, unprocessable } from "@/lib/errors";
import { isRepairsEnabled } from "@/lib/features/repairs";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";

const STEPS = ["shipped", "at_workshop", "returned", "arrived"] as const;
export type SendInStep = (typeof STEPS)[number];

const FIELD: Record<SendInStep, "shippedAt" | "atWorkshopAt" | "returnedAt" | "arrivedAt"> = {
  shipped: "shippedAt",
  at_workshop: "atWorkshopAt",
  returned: "returnedAt",
  arrived: "arrivedAt",
};

async function assertRepairs(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true },
  });
  if (!isRepairsEnabled(tenant?.featureFlags)) {
    throw forbidden("Repairs feature is not enabled for this tenant");
  }
}

/** R18 — advance send-in timeline monotonically. */
export async function advanceSendIn(
  ctx: ActingContext,
  serviceRequestId: string,
  input: { step: SendInStep; date: string; trackingRef?: string | null },
) {
  requireActingPartnerConsolePermission(ctx, "console:disposition:assign");
  await assertRepairs(ctx.tenantId);

  const sr = await prisma.serviceRequest.findFirst({
    where: { id: serviceRequestId, tenantId: ctx.tenantId },
  });
  if (!sr) throw notFound("Service request not found");
  if (sr.fulfilment !== "send_in") throw conflict("Request is not a send-in fulfilment");

  const idx = STEPS.indexOf(input.step);
  if (idx < 0) throw unprocessable("Invalid step");

  for (let i = 0; i < idx; i++) {
    const prev = FIELD[STEPS[i]!];
    if (!sr[prev]) {
      throw conflict(`Cannot record ${input.step} before ${STEPS[i]}`, { code: "OUT_OF_ORDER" });
    }
  }
  const field = FIELD[input.step];
  if (sr[field]) throw conflict(`Step ${input.step} already recorded`);

  const date = new Date(`${input.date}T00:00:00.000Z`);
  const data: Record<string, unknown> = { [field]: date };
  if (input.step === "shipped" && input.trackingRef?.trim()) {
    data.trackingRef = input.trackingRef.trim();
  }

  const updated = await prisma.serviceRequest.update({
    where: { id: sr.id },
    data,
  });

  await recordAudit({
    actor: ctx.actor,
    resource: "ServiceRequest",
    resourceId: sr.reference,
    action: "send_in_step",
    summary: `${sr.reference}: ${input.step}`,
    after: { step: input.step, date: input.date },
  });

  return updated;
}
