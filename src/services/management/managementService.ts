import type { ManagementContractDTO, ManagementOverviewDTO, TenantContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { prisma } from "@/lib/prisma";

function parseScope(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function isActiveContract(validFrom: Date, validTo: Date | null, now: Date): boolean {
  if (validFrom.getTime() > now.getTime()) return false;
  if (validTo != null && validTo.getTime() < now.getTime()) return false;
  return true;
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
                OR: [{ validTo: null }, { validTo: { gte: now } }],
                validFrom: { lte: now },
                user: { active: true, accountKind: "partner" },
              },
              include: {
                user: { select: { id: true, name: true, email: true, jobTitle: true } },
              },
              orderBy: { appRole: "asc" },
            },
          },
        },
      },
      orderBy: { validFrom: "desc" },
    });

    const active: ManagementContractDTO[] = contracts
      .filter((c) => isActiveContract(c.validFrom, c.validTo, now))
      .map((c) => ({
        id: c.id,
        organisationId: c.organisationId,
        organisationCode: c.organisation.code,
        organisationName: c.organisation.name,
        contact: c.organisation.contact,
        validFrom: c.validFrom.toISOString().slice(0, 10),
        validTo: c.validTo ? c.validTo.toISOString().slice(0, 10) : null,
        scope: parseScope(c.scope),
        people: c.organisation.memberships.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          jobTitle: m.user.jobTitle,
          appRole: m.appRole,
          email: m.user.email,
        })),
      }));

    return { tenantId: ctx.tenantId, contracts: active };
  },
};
