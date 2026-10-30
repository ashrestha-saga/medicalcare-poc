import type {
  ManagementContractDTO,
  ManagementOverviewDTO,
  ManagementPartnerAccessRowDTO,
  TenantContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { prisma } from "@/lib/prisma";
import { isLiveContract } from "@/services/access/partnerAccessService";

function parseScope(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export const managementService = {
  async getOverview(ctx: TenantContext): Promise<ManagementOverviewDTO> {
    requirePermission(ctx, "management:view");
    const now = new Date();

    const contracts = await prisma.serviceContract.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        organisation: {
          include: {
            memberships: {
              where: {
                isExternal: false,
                OR: [{ validTo: null }, { validTo: { gte: now } }],
                validFrom: { lte: now },
                user: { active: true, accountKind: "partner" },
              },
              include: {
                user: { select: { id: true, name: true, email: true, jobTitle: true } },
                staffAssignments: {
                  where: { tenantId: ctx.tenantId },
                  select: { tenantId: true },
                },
              },
              orderBy: { appRole: "asc" },
            },
          },
        },
      },
      orderBy: { validFrom: "desc" },
    });

    const active: ManagementContractDTO[] = contracts
      .filter((c) => isLiveContract(c, now))
      .map((c) => ({
        id: c.id,
        organisationId: c.organisationId,
        organisationCode: c.organisation.code,
        organisationName: c.organisation.name,
        contact: c.organisation.contact,
        validFrom: c.validFrom.toISOString().slice(0, 10),
        validTo: c.validTo ? c.validTo.toISOString().slice(0, 10) : null,
        scope: parseScope(c.scope),
        // Same rule as partner customer detail: org admins always; others only if assigned.
        people: c.organisation.memberships
          .filter((m) => m.appRole === "admin" || m.staffAssignments.length > 0)
          .map((m) => ({
            id: m.user.id,
            name: m.user.name,
            jobTitle: m.user.jobTitle,
            appRole: m.appRole,
            email: m.user.email,
          })),
      }));

    const orgIds = active.map((c) => c.organisationId);
    let latestAccess: ManagementPartnerAccessRowDTO[] = [];
    if (orgIds.length > 0) {
      const events = await prisma.auditEvent.findMany({
        where: {
          tenantId: ctx.tenantId,
          actorKind: "partner",
          organisationId: { in: orgIds },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 20,
      });
      latestAccess = events.map((e) => ({
        id: e.id,
        occurredAt: e.occurredAt.toISOString(),
        actorName: e.actorName,
        actorRole: e.actorRole,
        organisationName: e.organisationName,
        summary: e.summary,
        resource: e.resource,
        resourceId: e.resourceId,
        action: e.action,
      }));
    }

    return { tenantId: ctx.tenantId, contracts: active, latestAccess };
  },
};
