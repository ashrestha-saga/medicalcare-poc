import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TenantContext } from "@/interfaces";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createServiceRequestSchema } from "@/schemas/serviceRequest";
import { captureService } from "@/services/capture/captureService";
import { orderRequestService } from "@/services/order/orderRequestService";
import { serviceRequestService } from "@/services/requests/serviceRequestService";

const ctx: TenantContext = {
  tenantId: "demo-tenant",
  user: { id: "user-tech-1", name: "Anna Technik", role: "device_admin", tenantId: "demo-tenant" },
  correlationId: "sr-test",
};

const key = (s: string) => `test-${s}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const base = () =>
  createServiceRequestSchema.parse({
    idempotencyKey: key("base"),
    subjectType: "instance",
    subjectId: "instance-inv-10001",
    serviceType: "STK",
    site: "site-bonn",
    locationText: "Bonn Clinic, ICU, Room 4",
    deliveryAddress: "Central Medical Equipment Warehouse",
    raisedBy: "Anna Technik",
  });

let failingTargetId: string | null = null;

beforeAll(async () => {
  // AC-E2E-07 — a second target that always fails, next to the succeeding mail/oxid targets.
  const t = await prisma.dispatchTarget.create({
    data: { tenantId: "demo-tenant", type: "webhook", name: "Flaky ERP", endpoint: "mock://fail", enabled: true },
  });
  failingTargetId = t.id;
});

afterAll(async () => {
  if (failingTargetId) await prisma.dispatchTarget.delete({ where: { id: failingTargetId } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe("service requests — Phase 5 (AC #4, #7, #8, #11, #12)", () => {
  it("creates request + captured StatusEvent in one transaction, dispatches, and marks transmitted", async () => {
    const { request, created } = await serviceRequestService.create(base(), ctx);
    expect(created).toBe(true);
    expect(request.reference).toMatch(/^SR-\d{8}-[0-9A-F]{6}$/);
    expect(request.statusEvents.map((e) => e.state)).toEqual(["captured", "transmitted"]);
    expect(request.state).toBe("transmitted");
    expect(request.locationText).toBe("Bonn Clinic, ICU, Room 4");
    expect(request.deliveryAddress).toBe("Central Medical Equipment Warehouse");
  });

  it("location and delivery are stored as distinct values even when identical text", async () => {
    const same = "Bonn Clinic, ICU, Room 4";
    const { request } = await serviceRequestService.create({ ...base(), idempotencyKey: key("same"), deliveryAddress: same }, ctx);
    const row = await prisma.serviceRequest.findUnique({ where: { id: request.id } });
    expect(row?.locationText).toBe(same);
    expect(row?.deliveryAddress).toBe(same);
    // two columns, not one derived field
    await prisma.serviceRequest.update({ where: { id: request.id }, data: { deliveryAddress: "elsewhere" } });
    const again = await prisma.serviceRequest.findUnique({ where: { id: request.id } });
    expect(again?.locationText).toBe(same);
    expect(again?.deliveryAddress).toBe("elsewhere");
  });

  it("same idempotency key → same request, created=false, exactly one row (SS-701, AC-E2E-06)", async () => {
    const input = base();
    const first = await serviceRequestService.create(input, ctx);
    const second = await serviceRequestService.create(input, ctx);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.request.id).toBe(first.request.id);
    expect(await prisma.serviceRequest.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
  });

  it("concurrent identical submissions still yield exactly one row", async () => {
    const input = base();
    const results = await Promise.allSettled([serviceRequestService.create(input, ctx), serviceRequestService.create(input, ctx), serviceRequestService.create(input, ctx)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(await prisma.serviceRequest.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
  });

  it("same key with a different payload → 409 conflict (23.1)", async () => {
    const input = base();
    await serviceRequestService.create(input, ctx);
    await expect(serviceRequestService.create({ ...input, note: "materially different" }, ctx)).rejects.toMatchObject({ status: 409 });
  });

  it("verified proposal must be confirmed → 422, confirmed passes (FA-402/404, AC #4)", async () => {
    const proposed = { annex1: true, annex2: false, softwareClass: null, radiation: false, confidence: "verified" as const, source: "seed" };
    const unconfirmed = { ...base(), classification: { proposed, selected: [0], confirmed: false, overridden: false } };
    await expect(serviceRequestService.create(unconfirmed, ctx)).rejects.toMatchObject({ status: 422, message: "Please confirm the suggested inspection type." });
    const ok = await serviceRequestService.create({ ...unconfirmed, idempotencyKey: key("ok"), classification: { ...unconfirmed.classification, confirmed: true } }, ctx);
    expect(ok.created).toBe(true);
    expect(ok.request.classification?.confirmed).toBe(true);
  });

  it("derived proposal never blocks sending (AC #5)", async () => {
    const proposed = { annex1: true, annex2: null, softwareClass: null, radiation: false, confidence: "derived" as const, source: "seed" };
    const r = await serviceRequestService.create({ ...base(), serviceType: "DGUV", classification: { proposed, selected: [2], confirmed: false, overridden: true } }, ctx);
    expect(r.created).toBe(true);
    expect(r.request.serviceType).toBe("DGUV");
  });

  it("rejects an empty room / location and an empty delivery address server-side", async () => {
    await expect(serviceRequestService.create({ ...base(), locationText: "   " }, ctx)).rejects.toMatchObject({ status: 422 });
    await expect(serviceRequestService.create({ ...base(), deliveryAddress: "  " }, ctx)).rejects.toMatchObject({ status: 422 });
  });

  it("rejects subjects that do not belong to the tenant", async () => {
    await expect(serviceRequestService.create(base(), { ...ctx, tenantId: "other-tenant" })).rejects.toMatchObject({ status: 422 });
  });

  it("captured subject: serviceOnly is forced server-side and accepted as a subject (DAT-302a)", async () => {
    const captured = await captureService.create(
      { name: "Unknown pump", manufacturer: "", number: "", numberType: "none", nameplatePhoto: "data:image/jpeg;base64,AAAA" },
      "demo-tenant",
      "Anna Technik",
    );
    expect(captured.serviceOnly).toBe(true);
    const row = await prisma.capturedArticle.findUnique({ where: { id: captured.id } });
    expect(row?.serviceOnly).toBe(true);
    const r = await serviceRequestService.create({ ...base(), subjectType: "captured", subjectId: captured.id }, ctx);
    expect(r.created).toBe(true);
  });

  it("dispatch isolation: failing target records failure, others succeed, request still transmitted (SS-702, AC-E2E-07)", async () => {
    const { request } = await serviceRequestService.create(base(), ctx);
    const records = await prisma.dispatchRecord.findMany({ where: { serviceRequestId: request.id } });
    const byTarget = Object.fromEntries(records.map((r) => [r.target, r]));
    expect(byTarget["mail:Medical technology mailbox"]?.success).toBe(true);
    expect(byTarget["oxid:OXID service desk"]?.success).toBe(true);
    expect(byTarget["webhook:Flaky ERP"]?.success).toBe(false);
    expect(byTarget["webhook:Flaky ERP"]?.error).toMatch(/mock webhook failure/);
    expect(request.state).toBe("transmitted");
    expect(request.dispatchRecords.filter((d) => !d.success)).toHaveLength(1);
  });

  it("status feedback appends a StatusEvent; unknown reference → 404 (FA-601/602)", async () => {
    const { request } = await serviceRequestService.create(base(), ctx);
    const updated = await serviceRequestService.applyStatusFeedback(request.reference, { state: "acknowledged", source: "oxid", externalReference: "OXID-1" });
    expect(updated.state).toBe("acknowledged");
    expect(updated.statusEvents.at(-1)).toMatchObject({ state: "acknowledged", source: "oxid" });
    await expect(serviceRequestService.applyStatusFeedback("SR-00000000-NOPE", { state: "completed", source: "oxid" })).rejects.toBeInstanceOf(AppError);
  });
});

describe("order requests — Section 37", () => {
  it("creates a pending_approval order with items and is idempotent", async () => {
    const input = {
      idempotencyKey: key("order"),
      deliveryAddress: "Central Medical Equipment Warehouse",
      raisedBy: "Anna Technik",
      items: [{ articleNumber: "X200-BAT-01", description: "Battery", quantity: 2, unitPrice: 189 }],
    };
    const first = await orderRequestService.create(input, ctx);
    const second = await orderRequestService.create(input, ctx);
    expect(first.created).toBe(true);
    expect(first.order.approvalState).toBe("pending_approval");
    expect(first.order.items).toHaveLength(1);
    expect(second.created).toBe(false);
    expect(second.order.id).toBe(first.order.id);
    await expect(orderRequestService.create({ ...input, items: [{ ...input.items[0], quantity: 3 }] }, ctx)).rejects.toMatchObject({ status: 409 });
  });
});
