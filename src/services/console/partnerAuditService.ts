import type { PartnerContext } from "@/interfaces/session";
import type { ConsoleAuditListDTO, ConsoleActingScope } from "@/interfaces/console";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { prisma } from "@/lib/prisma";

function deriveActingScope(r: {
  actorKind: string;
  organisationId: string | null;
  serviceContractId: string | null;
  tenantId: string | null;
}): ConsoleActingScope {
  if (r.actorKind === "partner" && r.organisationId && r.serviceContractId) return "managing_org";
  if (r.actorKind === "partner" && r.organisationId && !r.tenantId) return "managing_org";
  if (r.actorKind === "clinic") return "tenant";
  if (r.actorKind === "system" && !r.tenantId) return "platform";
  if (r.actorKind === "partner" && r.tenantId) return "managing_org";
  return "other";
}

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
        events: rows.map((r) => {
          const actingScope = deriveActingScope(r);
          return {
            id: r.id,
            occurredAt: r.occurredAt.toISOString(),
            actingScope,
            capacity:
              actingScope === "managing_org"
                ? ("managing_org" as const)
                : actingScope === "tenant"
                  ? ("tenant" as const)
                  : ("other" as const),
            actorName: r.actorName,
            summary: r.summary,
            resource: r.resource,
            resourceId: r.resourceId,
            tenantId: r.tenantId,
          };
        }),
      };
    });
  },
};
