import { createHash } from "node:crypto";
import type { ActingContext, PartnerContext } from "@/interfaces";
import { notificationDedup } from "@/constants/notifications";
import { actorFromPartnerOrg } from "@/lib/auth/actorContext";
import { requirePartnerPermission, requirePermission } from "@/lib/auth/tenantContext";
import { conflict, forbidden, notFound, unprocessable } from "@/lib/errors";
import { requireRepairsEnabled } from "@/lib/features/repairs";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { notifyService } from "@/services/notifications/notifyService";
import { getCachedPartnerConsolePermissions } from "@/services/roles/roleGrantsService";

/** Pure ownership gate for createPartsProposal (E80).
 * `executorOrganisationId` is Organisation.id (not ExecutorOrg.id).
 */
export function assertPartsProposalOwnership(input: {
  assigneeUserId: string | null;
  executorOrganisationId: string | null;
  callerUserId: string;
  organisationId: string;
  canDispositionAssign: boolean;
}): void {
  if (
    !input.executorOrganisationId ||
    input.executorOrganisationId !== input.organisationId
  ) {
    throw forbidden("Parts proposals must be created by the executing organisation");
  }
  const isAssignee = input.assigneeUserId === input.callerUserId;
  if (!isAssignee && !input.canDispositionAssign) {
    throw forbidden(
      "Parts proposals require assignment to you or disposition lead permission",
    );
  }
}

async function assertTenantRepairs(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true },
  });
  requireRepairsEnabled(tenant?.featureFlags);
}

function partsFingerprint(
  lines: { description: string; partNo?: string | null; serialNo?: string | null; qty: number }[],
): string {
  const norm = lines
    .map((l) => `${l.description}|${l.partNo ?? ""}|${l.serialNo ?? ""}|${l.qty}`)
    .sort()
    .join(";");
  return createHash("sha256").update(norm).digest("hex").slice(0, 32);
}

/** R21 — create idempotent parts proposal from current maintenance parts / explicit lines. */
export async function createPartsProposal(
  ctx: ActingContext,
  serviceRequestId: string,
  organisationId: string,
  lines?: { description: string; partNo?: string | null; serialNo?: string | null; qty?: number }[],
) {
  requirePermission(ctx, "inspections:perform");
  await assertTenantRepairs(ctx.tenantId);

  const sr = await prisma.serviceRequest.findFirst({
    where: { id: serviceRequestId, tenantId: ctx.tenantId },
    include: {
      executorOrg: { select: { organisationId: true } },
      maintenanceEvents: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { parts: true },
      },
    },
  });
  if (!sr) throw notFound("Service request not found");

  const canDispositionAssign =
    ctx.user.accountKind === "partner" &&
    getCachedPartnerConsolePermissions(ctx.user.appRole).includes(
      "console:disposition:assign",
    );
  assertPartsProposalOwnership({
    assigneeUserId: sr.assigneeUserId,
    executorOrganisationId: sr.executorOrg?.organisationId ?? null,
    callerUserId: ctx.user.id,
    organisationId,
    canDispositionAssign,
  });

  let resolved = lines?.map((l) => ({
    description: l.description.trim(),
    partNo: l.partNo?.trim() || null,
    serialNo: l.serialNo?.trim() || null,
    qty: l.qty ?? 1,
  }));

  if (!resolved?.length) {
    const parts = sr.maintenanceEvents[0]?.parts ?? [];
    resolved = parts.map((p) => ({
      description: p.description,
      partNo: p.partNo,
      serialNo: p.serialNo,
      qty: p.qty,
    }));
  }

  if (!resolved.length || !resolved.some((l) => l.description)) {
    throw unprocessable("No parts lines to propose");
  }

  const fp = partsFingerprint(resolved);
  const existing = await prisma.partsOrderProposal.findFirst({
    where: {
      serviceRequestId: sr.id,
      organisationId,
      status: { in: ["open", "ordered"] },
    },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
  // Idempotent: same fingerprint → return existing
  if (existing) {
    const existingFp = partsFingerprint(
      existing.lines.map((l) => ({
        description: l.description,
        partNo: l.partNo,
        serialNo: l.serialNo,
        qty: l.qty,
      })),
    );
    if (existingFp === fp) return existing;
  }

  const created = await prisma.partsOrderProposal.create({
    data: {
      id: undefined,
      organisationId,
      tenantId: ctx.tenantId,
      serviceRequestId: sr.id,
      status: "open",
      channel: "plusorder",
      triggeredVia: "devicecare",
      createdBy: ctx.user.name,
      lines: {
        create: resolved.map((l) => ({
          description: l.description,
          partNo: l.partNo,
          serialNo: l.serialNo,
          qty: l.qty,
        })),
      },
    },
    include: { lines: true },
  });

  await recordAudit({
    actor: ctx.actor,
    resource: "PartsOrderProposal",
    resourceId: created.id,
    action: "create",
    summary: `Parts proposal for ${sr.reference}`,
  });

  // E107 — clinic visibility for parts order proposals tied to their request.
  await notifyService.pushToRoles(
    ctx.tenantId,
    ["device_admin", "security_officer", "superadmin"],
    "approval_order",
    notificationDedup.approvalOrder(created.id),
    `Teilebestellung vorgeschlagen: ${sr.reference}`,
    `${resolved.length} Position(en)`,
    { type: "request", id: sr.reference },
    ctx.tenantId,
    organisationId,
  );

  return created;
}

export async function listPartsProposals(ctx: PartnerContext, status?: string) {
  requirePartnerPermission(ctx, "console:disposition:view");
  return prisma.partsOrderProposal.findMany({
    where: {
      organisationId: ctx.organisationId,
      ...(status ? { status } : {}),
    },
    include: { lines: true, serviceRequest: { select: { reference: true, subjectId: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function orderPartsProposal(
  ctx: PartnerContext,
  proposalId: string,
  orderRef: string,
) {
  requirePartnerPermission(ctx, "console:disposition:assign");
  const role = String(ctx.user.appRole);
  if (role === "inspector") {
    throw forbidden("Inspectors cannot order parts proposals");
  }
  if (!orderRef.trim()) throw unprocessable("orderRef required");

  const row = await prisma.partsOrderProposal.findFirst({
    where: { id: proposalId, organisationId: ctx.organisationId },
    include: { serviceRequest: { select: { tenantId: true } } },
  });
  if (!row) throw notFound("Proposal not found");
  await assertTenantRepairs(row.tenantId ?? row.serviceRequest.tenantId);
  if (row.status !== "open") throw conflict("Proposal is not open");

  const updated = await prisma.partsOrderProposal.update({
    where: { id: row.id },
    data: {
      status: "ordered",
      orderedAt: new Date(),
      orderRef: orderRef.trim(),
      triggeredVia: "devicecare",
    },
    include: { lines: true },
  });

  await recordAudit({
    actor: actorFromPartnerOrg(ctx),
    resource: "PartsOrderProposal",
    resourceId: updated.id,
    action: "order",
    summary: `Ordered ${updated.orderRef}`,
  });

  return updated;
}

export async function discardPartsProposal(
  ctx: PartnerContext,
  proposalId: string,
  reason: string,
) {
  requirePartnerPermission(ctx, "console:disposition:assign");
  const role = String(ctx.user.appRole);
  if (role === "inspector") {
    throw forbidden("Inspectors cannot discard parts proposals");
  }
  if (!reason.trim()) throw unprocessable("reason required");

  const row = await prisma.partsOrderProposal.findFirst({
    where: { id: proposalId, organisationId: ctx.organisationId },
    include: { serviceRequest: { select: { tenantId: true } } },
  });
  if (!row) throw notFound("Proposal not found");
  await assertTenantRepairs(row.tenantId ?? row.serviceRequest.tenantId);
  if (row.status !== "open") throw conflict("Proposal is not open");

  const updated = await prisma.partsOrderProposal.update({
    where: { id: row.id },
    data: { status: "discarded", discardReason: reason.trim() },
    include: { lines: true },
  });

  await recordAudit({
    actor: actorFromPartnerOrg(ctx),
    resource: "PartsOrderProposal",
    resourceId: updated.id,
    action: "discard",
    summary: `Discarded parts proposal`,
  });

  return updated;
}
