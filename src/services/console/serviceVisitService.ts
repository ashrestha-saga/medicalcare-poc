import type { PartnerContext } from "@/interfaces/session";
import { actorFromPartnerOnTenant } from "@/lib/auth/actorContext";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { prisma } from "@/lib/prisma";
import { assertPartnerManagesTenant } from "@/services/access/partnerAccessService";
import { recordAudit } from "@/services/audit/auditService";
import { getCachedPartnerConsolePermissions } from "@/services/roles/roleGrantsService";

export type ServiceVisitDTO = {
  id: string;
  tenantId: string;
  tenantName: string;
  organisationId: string;
  siteId: string | null;
  siteName: string | null;
  plannedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  technicianUserId: string | null;
  technicianName: string | null;
  note: string | null;
  requestCount: number;
};

export type UpsertVisitInput = {
  id?: string;
  tenantId: string;
  siteId?: string | null;
  plannedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  technicianUserId?: string | null;
  note?: string | null;
};

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export const serviceVisitService = {
  async list(ctx: PartnerContext): Promise<{ rows: ServiceVisitDTO[] }> {
    const granted = getCachedPartnerConsolePermissions(ctx.user.appRole);
    if (!granted.includes("visits:manage") && !granted.includes("console:disposition:view")) {
      throw forbidden();
    }
    return runWithoutTenantAsync(async () => {
      const visits = await prisma.serviceVisit.findMany({
        where: { organisationId: ctx.organisationId },
        include: {
          tenant: { select: { name: true } },
          site: { select: { name: true } },
          technician: { select: { name: true } },
          _count: { select: { requests: true } },
        },
        orderBy: [{ plannedAt: "asc" }, { createdAt: "desc" }],
        take: 200,
      });
      return {
        rows: visits.map((v) => ({
          id: v.id,
          tenantId: v.tenantId,
          tenantName: v.tenant.name,
          organisationId: v.organisationId,
          siteId: v.siteId,
          siteName: v.site?.name ?? null,
          plannedAt: iso(v.plannedAt),
          startedAt: iso(v.startedAt),
          completedAt: iso(v.completedAt),
          technicianUserId: v.technicianUserId,
          technicianName: v.technician?.name ?? null,
          note: v.note,
          requestCount: v._count.requests,
        })),
      };
    });
  },

  async upsert(ctx: PartnerContext, input: UpsertVisitInput): Promise<ServiceVisitDTO> {
    const granted = getCachedPartnerConsolePermissions(ctx.user.appRole);
    if (!granted.includes("visits:manage")) throw forbidden();

    return runWithoutTenantAsync(async () => {
      const access = await assertPartnerManagesTenant(
        ctx.user.id,
        ctx.organisationId,
        input.tenantId,
      );

      if (input.siteId) {
        const site = await prisma.site.findFirst({
          where: { id: input.siteId, tenantId: input.tenantId },
          select: { id: true },
        });
        if (!site) throw unprocessable("Unknown site.", { field: "siteId" });
      }

      const data = {
        tenantId: input.tenantId,
        organisationId: ctx.organisationId,
        siteId: input.siteId ?? null,
        plannedAt: input.plannedAt ? new Date(input.plannedAt) : null,
        startedAt: input.startedAt ? new Date(input.startedAt) : null,
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
        technicianUserId: input.technicianUserId ?? null,
        note: input.note?.trim() || null,
      };

      const row = input.id
        ? await prisma.serviceVisit.update({
            where: { id: input.id },
            data,
            include: {
              tenant: { select: { name: true } },
              site: { select: { name: true } },
              technician: { select: { name: true } },
              _count: { select: { requests: true } },
            },
          })
        : await prisma.serviceVisit.create({
            data,
            include: {
              tenant: { select: { name: true } },
              site: { select: { name: true } },
              technician: { select: { name: true } },
              _count: { select: { requests: true } },
            },
          });

      if (input.id && row.organisationId !== ctx.organisationId) {
        throw notFound("Visit not found.");
      }

      await recordAudit({
        actor: actorFromPartnerOnTenant(ctx, input.tenantId, access.contractId),
        resource: "service_visit",
        resourceId: row.id,
        action: input.id ? "update" : "create",
        summary: input.id ? `Updated visit ${row.id}` : `Created visit ${row.id}`,
      });

      return {
        id: row.id,
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        organisationId: row.organisationId,
        siteId: row.siteId,
        siteName: row.site?.name ?? null,
        plannedAt: iso(row.plannedAt),
        startedAt: iso(row.startedAt),
        completedAt: iso(row.completedAt),
        technicianUserId: row.technicianUserId,
        technicianName: row.technician?.name ?? null,
        note: row.note,
        requestCount: row._count.requests,
      };
    });
  },

  async start(ctx: PartnerContext, visitId: string): Promise<ServiceVisitDTO> {
    return this.upsert(ctx, {
      id: visitId,
      tenantId: (
        await runWithoutTenantAsync(() =>
          prisma.serviceVisit.findFirst({
            where: { id: visitId, organisationId: ctx.organisationId },
            select: { tenantId: true },
          }),
        )
      )?.tenantId ?? (() => { throw notFound("Visit not found."); })(),
      startedAt: new Date().toISOString(),
    });
  },
};
