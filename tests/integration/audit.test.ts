import { afterAll, describe, expect, it } from "vitest";
import type { TenantContext } from "@/interfaces";
import { prisma } from "@/lib/prisma";
import { createServiceRequestSchema } from "@/schemas/serviceRequest";
import { auditService } from "@/services/audit/auditService";
import { serviceRequestService } from "@/services/requests/serviceRequestService";
import { roleGrantsService } from "@/services/roles/roleGrantsService";
import { userAdminService } from "@/services/users/userAdminService";

const adminCtx: TenantContext = {
  tenantId: "demo-tenant",
  user: {
    id: "user-admin-1",
    name: "Admin Klinik",
    accountKind: "clinic",
    role: "superadmin",
    tenantId: "demo-tenant",
  },
  correlationId: "audit-test",
};

const techCtx: TenantContext = {
  tenantId: "demo-tenant",
  user: {
    id: "user-tech-1",
    name: "Anna Technik",
    accountKind: "clinic",
    role: "device_admin",
    tenantId: "demo-tenant",
  },
  correlationId: "audit-sr",
};

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { tenantId: "audit-other-tenant" } }).catch(() => undefined);
  await prisma.tenant.deleteMany({ where: { id: "audit-other-tenant" } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe("audit trail", () => {
  it("records user create/update/delete with snapshots", async () => {
    const email = `audit-${Date.now()}@demo.local`;
    const created = await userAdminService.create(adminCtx, {
      email,
      name: "Audit Person",
      role: "user",
      password: "password12",
      confirmPassword: "password12",
      active: true,
    });

    const createdRow = await prisma.auditEvent.findFirst({
      where: { tenantId: "demo-tenant", resource: "user", resourceId: created.id, action: "create" },
    });
    expect(createdRow?.actorUserId).toBe("user-admin-1");
    expect(createdRow?.actorKind).toBe("clinic");
    expect(createdRow?.after).toContain(email);

    await userAdminService.update(adminCtx, created.id, {
      name: "Audit Person Renamed",
      role: "user",
      active: true,
    });
    const updatedRow = await prisma.auditEvent.findFirst({
      where: { tenantId: "demo-tenant", resource: "user", resourceId: created.id, action: "update" },
    });
    expect(updatedRow?.before).toContain("Audit Person");
    expect(updatedRow?.after).toContain("Audit Person Renamed");

    await userAdminService.remove(adminCtx, created.id);
    const deletedRow = await prisma.auditEvent.findFirst({
      where: { tenantId: "demo-tenant", resource: "user", resourceId: created.id, action: "delete" },
    });
    expect(deletedRow?.before).toContain(email);
  });

  it("records role grant changes", async () => {
    const before = await roleGrantsService.listCatalog(adminCtx);
    const userRole = before.find((r) => r.value === "user");
    expect(userRole).toBeTruthy();
    await roleGrantsService.updateRole(adminCtx, "user", [...userRole!.permissions]);
    const row = await prisma.auditEvent.findFirst({
      where: { tenantId: "demo-tenant", resource: "role", resourceId: "user", action: "grant" },
      orderBy: { occurredAt: "desc" },
    });
    expect(row?.actorKind).toBe("clinic");
    expect(row?.before).toContain("permissions");
  });

  it("keeps StatusEvent and writes AuditEvent on request create", async () => {
    const { request, created } = await serviceRequestService.create(
      createServiceRequestSchema.parse({
        idempotencyKey: `audit-sr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        subjectType: "instance",
        subjectId: "instance-inv-10001",
        serviceType: "STK",
        site: "site-bonn",
        locationText: "Bonn Clinic, ICU, Room 4",
        deliveryAddress: "Central Medical Equipment Warehouse",
        raisedBy: "Anna Technik",
      }),
      techCtx,
    );
    expect(created).toBe(true);
    expect(request.statusEvents.length).toBeGreaterThan(0);
    const audit = await prisma.auditEvent.findFirst({
      where: { tenantId: "demo-tenant", resource: "request", resourceId: request.reference, action: "create" },
    });
    expect(audit?.actorUserId).toBe("user-tech-1");
  });

  it("lists only the acting tenant", async () => {
    await prisma.tenant.create({ data: { id: "audit-other-tenant", name: "Other clinic" } });
    await prisma.auditEvent.create({
      data: {
        tenantId: "audit-other-tenant",
        actorKind: "clinic",
        actorName: "Other",
        resource: "user",
        resourceId: "secret-user",
        action: "create",
        summary: "Should not leak",
      },
    });
    const listed = await auditService.list(adminCtx, { limit: 50 });
    expect(listed.events.every((e) => e.tenantId === "demo-tenant")).toBe(true);
    expect(listed.events.some((e) => e.resourceId === "secret-user")).toBe(false);
  });
});
