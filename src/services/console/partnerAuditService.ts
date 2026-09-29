import type { PartnerContext } from "@/interfaces/session";
import type { ConsoleAuditListDTO } from "@/interfaces/console";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { prisma } from "@/lib/prisma";

export const partnerAuditService = {
  async list(ctx: PartnerContext, limit = 100): Promise<ConsoleAuditListDTO> {
    const take = Math.min(Math.max(limit, 1), 200);
    return runWithoutTenantAsync(async () => {
      const rows = await prisma.auditEvent.findMany({
        where: {
          OR: [
            { organisationId: ctx.organisationId },
            { actorKind: "partner", organisationId: ctx.organisationId },
          ],
        },
        orderBy: { occurredAt: "desc" },
        take,
      });

      return {
        events: rows.map((r) => ({
          id: r.id,
          occurredAt: r.occurredAt.toISOString(),
          capacity:
            r.actorKind === "partner"
              ? ("managing_org" as const)
              : r.actorKind === "clinic"
                ? ("tenant" as const)
                : ("other" as const),
          actorName: r.actorName,
          summary: r.summary,
          resource: r.resource,
          resourceId: r.resourceId,
          tenantId: r.tenantId,
        })),
      };
    });
  },
};
