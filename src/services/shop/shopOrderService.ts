import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { CreateOrderRequestResult, OrderRequestDTO, TenantWorkContext } from "@/interfaces";
import type { SubmitShopOrderResult } from "@/interfaces/shop";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { fingerprint, newReference } from "@/lib/crypto";
import {
  AppError,
  conflict,
  downstreamUnavailable,
  forbidden,
  notFound,
  unprocessable,
} from "@/lib/errors";
import { requireOrderingEnabled } from "@/lib/features/ordering";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { CreateOrderRequestInput } from "@/schemas/orderRequest";
import type { SubmitShopOrderInput } from "@/schemas/shop";
import { recordAudit } from "@/services/audit/auditService";
import { toOrderRequestDTO } from "@/services/shared/mappers";
import { assertDeviceInWorkAreas } from "@/services/users/userAreaScope";
import { shopAuthService } from "@/services/shop/shopAuthService";
import { shopConnectionService } from "@/services/shop/shopConnectionService";
import { getShopProvider } from "@/services/shop/shopRegistry";
import { ShopError } from "@/services/shop/types";
import { recordExternalCall } from "@/services/shared/externalCallLog";

function orderFingerprint(input: CreateOrderRequestInput): string {
  return fingerprint({
    subjectType: input.subjectType ?? null,
    subjectId: input.subjectId ?? null,
    deliveryAddress: input.deliveryAddress,
    note: input.note ?? null,
    raisedBy: input.raisedBy,
    purpose: input.purpose ?? "parts",
    items: [...input.items]
      .map((i) => ({ n: i.articleNumber, q: i.quantity }))
      .sort((a, b) => a.n.localeCompare(b.n)),
  });
}

async function requireOrderingFlag(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true },
  });
  requireOrderingEnabled(tenant?.featureFlags);
}

function deviceHref(id: string): string {
  return `/devices?id=${encodeURIComponent(id)}`;
}

function deviceLabel(row: {
  inventoryNumber: string;
  model?: { tradeName: string | null; modelName: string | null; manufacturer: string | null } | null;
}): string {
  const name =
    row.model?.tradeName?.trim() ||
    row.model?.modelName?.trim() ||
    row.model?.manufacturer?.trim() ||
    null;
  return name ? `${row.inventoryNumber} · ${name}` : row.inventoryNumber;
}

/** Attach inventory device labels for orders that reference a device instance. */
async function withDeviceLinks(
  tenantId: string,
  orders: OrderRequestDTO[],
): Promise<OrderRequestDTO[]> {
  const ids = [
    ...new Set(
      orders
        .map((o) => o.deviceInstanceId ?? (o.subjectType === "instance" ? o.subjectId : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (ids.length === 0) return orders.map((o) => ({ ...o, device: o.device ?? null }));

  const devices = await prisma.deviceInstance.findMany({
    where: { tenantId, id: { in: ids } },
    select: {
      id: true,
      inventoryNumber: true,
      model: { select: { tradeName: true, modelName: true, manufacturer: true } },
    },
  });
  const byId = new Map(devices.map((d) => [d.id, d]));

  return orders.map((o) => {
    const id = o.deviceInstanceId ?? (o.subjectType === "instance" ? o.subjectId : null);
    const row = id ? byId.get(id) : undefined;
    if (!row) return { ...o, device: null };
    return {
      ...o,
      deviceInstanceId: o.deviceInstanceId ?? row.id,
      device: {
        id: row.id,
        inventoryNumber: row.inventoryNumber,
        label: deviceLabel(row),
        href: deviceHref(row.id),
      },
    };
  });
}

function mapShopError(error: unknown): never {
  if (error instanceof ShopError) {
    if (error.code === "PIN_INVALID") {
      throw new AppError(422, "PIN_INVALID", error.message, { field: "pin" });
    }
    if (error.code === "BASKET_NOT_EMPTY") {
      throw new AppError(409, "BASKET_NOT_EMPTY", error.message);
    }
    if (error.code === "LINE_REJECTED") {
      throw new AppError(422, "LINE_REJECTED", error.message);
    }
    if (error.code === "UNAUTHORIZED") throw forbidden(error.message);
    throw downstreamUnavailable(error.message);
  }
  throw error;
}

export const shopOrderService = {
  async createIntent(
    input: CreateOrderRequestInput,
    ctx: TenantWorkContext,
  ): Promise<CreateOrderRequestResult> {
    requirePermission(ctx, "parts:request");
    await requireOrderingFlag(ctx.tenantId);

    if (!input.deliveryAddress.trim()) {
      throw unprocessable("Please enter the delivery address.", { field: "deliveryAddress" });
    }
    if (input.items.length === 0) {
      throw unprocessable("Add at least one article.", { field: "items" });
    }

    if (input.subjectType === "instance" && input.subjectId) {
      const device = await prisma.deviceInstance.findFirst({
        where: { id: input.subjectId, tenantId: ctx.tenantId },
        select: { id: true, areaId: true },
      });
      if (!device) throw unprocessable("Unknown device instance.", { field: "subjectId" });
      await assertDeviceInWorkAreas(ctx, device.areaId);
    }
    if (input.subjectType === "captured" && input.subjectId) {
      throw unprocessable("Manual-capture subjects cannot create shop orders.", {
        field: "subjectId",
        code: "serviceOnly",
      });
    }

    const connection = await prisma.tenantShopConnection.findUnique({ where: { tenantId: ctx.tenantId } });
    const fp = orderFingerprint(input);
    const purpose = input.purpose ?? "parts";

    const outcome = await prisma
      .$transaction(async (tx) => {
        const existing = await tx.orderRequest.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { items: true },
        });
        if (existing) {
          if (existing.tenantId !== ctx.tenantId) throw conflict("Idempotency key belongs to another tenant.");
          if (existing.fingerprint !== fp) {
            throw conflict("This idempotency key was already used for a different order.", {
              reference: existing.reference,
            });
          }
          return { row: existing, created: false };
        }
        const row = await tx.orderRequest.create({
          data: {
            reference: newReference("OR"),
            idempotencyKey: input.idempotencyKey,
            fingerprint: fp,
            tenantId: ctx.tenantId,
            raisedBy: ctx.user.name,
            raisedById: ctx.user.id,
            subjectType: input.subjectType ?? null,
            subjectId: input.subjectId ?? null,
            deliveryAddress: input.deliveryAddress.trim(),
            note: input.note?.trim() || null,
            approvalState: "pending_approval",
            state: "captured",
            correlationId: ctx.correlationId,
            shopConnectionId: connection?.id ?? null,
            purpose,
            deviceInstanceId: input.deviceInstanceId ?? (input.subjectType === "instance" ? input.subjectId : null) ?? null,
            serviceRequestId: input.serviceRequestId ?? null,
            deliverySiteId: input.deliverySiteId ?? null,
            externalState: "intent",
            triggeredVia: "devicecare",
            items: {
              create: input.items.map((i) => ({
                tenantId: ctx.tenantId,
                articleId: i.articleId ?? null,
                articleNumber: i.articleNumber,
                description: i.description,
                quantity: i.quantity,
                unitPrice: null,
                shopArticleId: i.shopArticleId ?? i.articleId ?? null,
                gtin: i.gtin ?? null,
                priceSource: "none",
              })),
            },
          },
          include: { items: true },
        });
        return { row, created: true };
      })
      .catch(async (error) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const row = await prisma.orderRequest.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
            include: { items: true },
          });
          if (row) return { row, created: false };
        }
        throw error;
      });

    if (outcome.created) {
      logger.info("shop.order_intent.created", {
        correlationId: ctx.correlationId,
        reference: outcome.row.reference,
        tenantId: ctx.tenantId,
      });
      await recordAudit({
        actor: actorFromContext(ctx),
        resource: "order",
        resourceId: outcome.row.id,
        action: "create",
        summary: `Created shop order intent ${outcome.row.reference}`,
        after: { reference: outcome.row.reference, itemCount: outcome.row.items.length },
      });
    }
    return { order: toOrderRequestDTO(outcome.row), created: outcome.created };
  },

  async submit(
    reference: string,
    input: SubmitShopOrderInput,
    ctx: TenantWorkContext,
  ): Promise<SubmitShopOrderResult> {
    requirePermission(ctx, "parts:request");
    await requireOrderingFlag(ctx.tenantId);

    const order = await prisma.orderRequest.findFirst({
      where: { reference, tenantId: ctx.tenantId },
      include: { items: true },
    });
    if (!order) throw notFound("Order not found");
    if (order.externalState === "ordered") {
      return {
        order: {
          reference: order.reference,
          externalState: order.externalState,
          externalOrderRef: order.externalOrderRef,
          orderedByName: order.orderedByName,
          netTotalFromSource: order.netTotalFromSource ? Number(order.netTotalFromSource) : null,
          currency: order.currency,
        },
      };
    }
    if (!["intent", "failed", "submitting"].includes(order.externalState)) {
      throw conflict(`Order cannot be submitted from state ${order.externalState}`);
    }

    const session = await shopAuthService.getSession(ctx.tenantId);
    if (!session) throw downstreamUnavailable("Shop is not connected.");
    const provider = getShopProvider(await shopConnectionService.getProviderType(ctx.tenantId));
    const status = await shopConnectionService.getPublicStatus(ctx.tenantId);

    let orderedByName: string | null = null;
    if (status.hasSubUsers) {
      if (!input.pin) throw unprocessable("PIN is required for this shop account.", { field: "pin" });
      try {
        const buyer = await provider.checkout.validateBuyer(session, input.pin);
        orderedByName = buyer.displayName;
      } catch (error) {
        mapShopError(error);
      }
    }

    const leaseBy = ctx.user.id;
    const leased = await shopConnectionService.tryAcquireSubmitLease(ctx.tenantId, leaseBy);
    if (!leased) throw conflict("Another shop order is already in progress for this clinic.");

    const submitKey = order.submitKey || randomUUID();
    await prisma.orderRequest.update({
      where: { id: order.id },
      data: {
        externalState: "submitting",
        submitKey,
        lastSubmitError: null,
        orderedByName,
      },
    });

    const started = Date.now();
    try {
      const placed = await provider.checkout.placeOrder(session, {
        lines: order.items.map((i) => ({
          articleNumber: i.articleNumber,
          amount: i.quantity,
          // Prefer shopArticleId; fall back to articleId (older intents stored OXID id there).
          shopArticleId: i.shopArticleId ?? i.articleId ?? undefined,
        })),
        pin: input.pin,
        deliveryAddressId: input.deliveryAddressId,
        // DeviceCare owns the checkout cart for this submit — always clear leftovers first.
        clearBasket: true,
        remark: `DeviceCare ${order.reference}`,
        idempotencyKey: submitKey,
        paymentId: session.config.paymentId,
        deliverySetId: session.config.deliverySetId,
      });

      const updated = await prisma.$transaction(async (tx) => {
        for (const line of placed.lines) {
          await tx.orderItem.updateMany({
            where: { orderRequestId: order.id, articleNumber: line.articleNumber },
            data: {
              unitPrice: line.unitPrice,
              quantityConfirmed: line.quantity,
              priceSource: "shop",
            },
          });
        }
        const row = await tx.orderRequest.update({
          where: { id: order.id },
          data: {
            externalState: "ordered",
            externalOrderRef: placed.orderNumber,
            externalOrderId: placed.orderId ?? null,
            orderedByName,
            netTotalFromSource: placed.netTotal ?? null,
            currency: placed.currency ?? "EUR",
            priceBreakdownJson: placed.priceBreakdown
              ? JSON.stringify(placed.priceBreakdown)
              : null,
            approvalState: "approved",
            lastSubmitError: null,
          },
          include: { items: true },
        });
        await tx.orderStatusEvent.create({
          data: {
            tenantId: ctx.tenantId,
            orderRequestId: order.id,
            externalState: "ordered",
            source: "submit",
            eventId: `submit:${submitKey}`,
            actorName: orderedByName,
            netTotal: placed.netTotal ?? null,
          },
        });
        return row;
      });

      await recordExternalCall({
        system: "oxid",
        operation: "submitOrder",
        identifier: order.reference,
        tenantId: ctx.tenantId,
        correlationId: ctx.correlationId,
        durationMs: Date.now() - started,
        cacheHit: false,
        success: true,
      });
      await recordAudit({
        actor: actorFromContext(ctx),
        resource: "order",
        resourceId: order.id,
        action: "submit",
        summary: `Submitted shop order ${placed.orderNumber}`,
        after: { externalOrderRef: placed.orderNumber, orderedByName },
      });

      return {
        order: {
          reference: updated.reference,
          externalState: updated.externalState,
          externalOrderRef: updated.externalOrderRef,
          orderedByName: updated.orderedByName,
          netTotalFromSource: updated.netTotalFromSource ? Number(updated.netTotalFromSource) : null,
          currency: updated.currency,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedState = error instanceof ShopError && error.code === "BASKET_NOT_EMPTY" ? "intent" : "failed";
      await prisma.orderRequest.update({
        where: { id: order.id },
        data: {
          externalState: failedState,
          lastSubmitError: message.slice(0, 1000),
        },
      });
      await recordExternalCall({
        system: "oxid",
        operation: "submitOrder",
        identifier: order.reference,
        tenantId: ctx.tenantId,
        correlationId: ctx.correlationId,
        durationMs: Date.now() - started,
        cacheHit: false,
        success: false,
        error: message,
      });
      mapShopError(error);
    } finally {
      await shopConnectionService.releaseSubmitLease(ctx.tenantId, leaseBy);
    }
  },

  async list(tenantId: string, limit = 200): Promise<OrderRequestDTO[]> {
    const rows = await prisma.orderRequest.findMany({
      where: { tenantId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toOrderRequestDTO);
  },

  async listShopOrders(tenantId: string, limit = 500) {
    const rows = await prisma.orderRequest.findMany({
      where: { tenantId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const orders = await withDeviceLinks(tenantId, rows.map(toOrderRequestDTO));
    const summary = {
      total: orders.length,
      ordered: 0,
      submitting: 0,
      intent: 0,
      shipped: 0,
      failed: 0,
      other: 0,
    };
    for (const o of orders) {
      const state = o.externalState ?? "intent";
      if (state === "ordered") summary.ordered += 1;
      else if (state === "submitting") summary.submitting += 1;
      else if (state === "intent") summary.intent += 1;
      else if (state === "shipped") summary.shipped += 1;
      else if (state === "failed" || state === "cancelled" || state === "expired") summary.failed += 1;
      else summary.other += 1;
    }
    return { orders, summary };
  },

  async getByReference(tenantId: string, reference: string): Promise<OrderRequestDTO> {
    const row = await prisma.orderRequest.findFirst({
      where: { tenantId, reference },
      include: {
        items: true,
        statusEvents: { orderBy: { receivedAt: "desc" } },
      },
    });
    if (!row) throw notFound("Shop order not found");
    const [order] = await withDeviceLinks(tenantId, [toOrderRequestDTO(row)]);
    return order;
  },
};
