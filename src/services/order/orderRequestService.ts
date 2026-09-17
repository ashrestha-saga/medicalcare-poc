import { Prisma } from "@prisma/client";
import type { CreateOrderRequestResult, OrderRequestDTO, TenantContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { fingerprint, newReference } from "@/lib/crypto";
import { conflict, unprocessable } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { CreateOrderRequestInput } from "@/schemas/orderRequest";
import { toOrderRequestDTO } from "@/services/shared/mappers";

/**
 * Section 37 — spare-parts order *requests*. A separate business operation from
 * service requests; always lands in `pending_approval` and requires an
 * authorized buyer downstream. Same idempotency contract as service requests.
 */
export function orderFingerprint(input: CreateOrderRequestInput): string {
  return fingerprint({
    subjectType: input.subjectType ?? null,
    subjectId: input.subjectId ?? null,
    deliveryAddress: input.deliveryAddress,
    note: input.note ?? null,
    raisedBy: input.raisedBy,
    items: [...input.items]
      .map((i) => ({ n: i.articleNumber, q: i.quantity }))
      .sort((a, b) => a.n.localeCompare(b.n)),
  });
}

export const orderRequestService = {
  async create(input: CreateOrderRequestInput, ctx: TenantContext): Promise<CreateOrderRequestResult> {
    requirePermission(ctx, "parts:request");
    const { tenantId, correlationId } = ctx;
    if (!input.deliveryAddress.trim()) throw unprocessable("Please enter the delivery address.", { field: "deliveryAddress" });
    if (input.items.length === 0) throw unprocessable("Add at least one spare part.", { field: "items" });

    if (input.subjectType === "captured" && input.subjectId) {
      // A manual capture is a service-only subject (DAT-302a); orders may reference it
      // for context, but it must still belong to this tenant.
      const cap = await prisma.capturedArticle.findFirst({ where: { id: input.subjectId, tenantId }, select: { id: true } });
      if (!cap) throw unprocessable("Unknown captured article.", { field: "subjectId" });
    }

    const fp = orderFingerprint(input);
    const outcome = await prisma
      .$transaction(async (tx) => {
        const existing = await tx.orderRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true } });
        if (existing) {
          if (existing.tenantId !== tenantId) throw conflict("Idempotency key belongs to another tenant.");
          if (existing.fingerprint !== fp) throw conflict("This idempotency key was already used for a different order.", { reference: existing.reference });
          return { row: existing, created: false };
        }
        const row = await tx.orderRequest.create({
          data: {
            reference: newReference("OR"),
            idempotencyKey: input.idempotencyKey,
            fingerprint: fp,
            tenantId,
            raisedBy: ctx.user.name,
            raisedById: ctx.user.id,
            subjectType: input.subjectType ?? null,
            subjectId: input.subjectId ?? null,
            deliveryAddress: input.deliveryAddress.trim(),
            note: input.note?.trim() || null,
            approvalState: "pending_approval",
            state: "captured",
            correlationId,
            items: {
              create: input.items.map((i) => ({
                articleId: i.articleId ?? null,
                articleNumber: i.articleNumber,
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unitPrice ?? null,
              })),
            },
          },
          include: { items: true },
        });
        return { row, created: true };
      })
      .catch(async (error) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const row = await prisma.orderRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true } });
          if (row) return { row, created: false };
        }
        throw error;
      });

    if (outcome.created) logger.info("order_request.created", { correlationId, reference: outcome.row.reference, tenantId });
    return { order: toOrderRequestDTO(outcome.row), created: outcome.created };
  },

  async list(tenantId: string, limit = 20): Promise<OrderRequestDTO[]> {
    const rows = await prisma.orderRequest.findMany({ where: { tenantId }, include: { items: true }, orderBy: { createdAt: "desc" }, take: limit });
    return rows.map(toOrderRequestDTO);
  },
};
