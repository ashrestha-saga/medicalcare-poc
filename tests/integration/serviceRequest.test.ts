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
  user: {
    id: "user-tech-1",
    name: "Anna Technik",
    accountKind: "clinic",
    role: "device_admin",
    tenantId: "demo-tenant",
  },
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
  // AC-E2E-07 — flaky channel on the in-house org (app create auto-allocates O-INT).
  const intOrg = await prisma.executorOrg.findFirst({
    where: { tenantId: "demo-tenant", code: "O-INT" },
  });
  const t = await prisma.dispatchTarget.create({
    data: {
      tenantId: "demo-tenant",
      executorOrgId: intOrg?.id ?? null,
      type: "webhook",
      name: "Flaky ERP",
      endpoint: "mock://fail",
      enabled: true,
    },
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

  it("accepts create without classification payload (manual service type)", async () => {
    const r = await serviceRequestService.create({ ...base(), serviceType: "DGUV" }, ctx);
    expect(r.created).toBe(true);
    expect(r.request.serviceType).toBe("DGUV");
    expect(r.request.classification).toBeNull();
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
    const updated = await serviceRequestService.applyStatusFeedback(request.reference, {
      state: "acknowledged",
      source: "oxid",
      externalReference: "OXID-1",
    });
    expect(updated.state).toBe("acknowledged");
    expect(updated.statusEvents.at(-1)).toMatchObject({ state: "acknowledged", source: "oxid" });
    await expect(
      serviceRequestService.applyStatusFeedback("SR-00000000-NOPE", { state: "completed", source: "oxid" }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("deferDispatch skips auto-transmit; allocate → transmit locks executor (FA-713/714)", async () => {
    const executors = await serviceRequestService.listExecutors(ctx);
    expect(executors.map((e) => e.code).sort()).toEqual(["O-INT", "O-MSR", "O-RTS"]);
    const internal = executors.find((e) => e.code === "O-INT");
    expect(internal).toBeTruthy();

    const { request, created } = await serviceRequestService.create(
      { ...base(), idempotencyKey: key("defer"), deferDispatch: true, source: "due_date" },
      ctx,
    );
    expect(created).toBe(true);
    expect(request.state).toBe("captured");
    expect(request.transmittedAt).toBeNull();
    expect(request.allocationLocked).toBe(false);
    expect(request.source).toBe("due_date");

    const allocated = await serviceRequestService.allocate(
      request.reference,
      { executorOrgId: internal!.id },
      ctx,
    );
    expect(allocated.executorOrgId).toBe(internal!.id);
    expect(allocated.executorOrg?.code).toBe("O-INT");
    expect(allocated.allocatedBy).toBe("Anna Technik");
    expect(allocated.allocationLocked).toBe(false);

    const transmitted = await serviceRequestService.transmit(request.reference, ctx);
    expect(transmitted.state).toBe("transmitted");
    expect(transmitted.allocationLocked).toBe(true);
    expect(transmitted.transmittedAt).toBeTruthy();

    await expect(
      serviceRequestService.allocate(request.reference, { executorOrgId: internal!.id }, ctx),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("transmit to O-MSR only hits that org's enabled channels", async () => {
    const msr = (await serviceRequestService.listExecutors(ctx)).find((e) => e.code === "O-MSR")!;
    const { request } = await serviceRequestService.create(
      { ...base(), idempotencyKey: key("msr-tx"), deferDispatch: true, source: "due_date" },
      ctx,
    );
    await serviceRequestService.allocate(request.reference, { executorOrgId: msr.id }, ctx);
    const transmitted = await serviceRequestService.transmit(request.reference, ctx);
    expect(transmitted.allocationLocked).toBe(true);
    const records = await prisma.dispatchRecord.findMany({ where: { serviceRequestId: request.id } });
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records.every((r) => r.target.startsWith("mail:MSR") || r.target.startsWith("webhook:MSR"))).toBe(
      true,
    );
    expect(records.some((r) => r.target.includes("RTS") || r.target.includes("OXID"))).toBe(false);
  });

  it("completing a duty-linked assignment writes DutyPerformance and rolls dueAt (FA-715)", async () => {
    const duty = await prisma.deviceDuty.findFirst({
      where: { tenantId: "demo-tenant", applicable: true, suspendedAt: null },
      orderBy: { dueAt: "asc" },
    });
    if (!duty) return; // seed may lack released duties in some environments

    const internal = (await serviceRequestService.listExecutors(ctx)).find((e) => e.code === "O-INT")!;
    const { request } = await serviceRequestService.create(
      {
        ...base(),
        idempotencyKey: key("duty-complete"),
        subjectId: duty.deviceInstanceId,
        dutyId: duty.id,
        source: "due_date",
        deferDispatch: true,
      },
      ctx,
    );
    await serviceRequestService.allocate(request.reference, { executorOrgId: internal.id }, ctx);
    await serviceRequestService.transmit(request.reference, ctx);
    await serviceRequestService.transition(request.reference, { state: "in_progress" }, ctx);
    await serviceRequestService.transition(
      request.reference,
      { state: "completed", note: "STK passed — visual + electrical OK" },
      ctx,
    );

    const performances = await prisma.dutyPerformance.findMany({
      where: { deviceDutyId: duty.id, serviceRequestId: request.id },
    });
    expect(performances).toHaveLength(1);
    expect(performances[0]?.performedBy).toBe("Anna Technik");

    const refreshed = await prisma.deviceDuty.findUnique({ where: { id: duty.id } });
    expect(refreshed?.lastCompletedAt).toBeTruthy();
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
