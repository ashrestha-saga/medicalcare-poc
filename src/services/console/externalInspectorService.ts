import type { PartnerContext } from "@/interfaces/session";
import type { ConsoleStaffListDTO, ConsoleStaffMemberDTO } from "@/interfaces/console";
import type {
  ConsoleExternalInviteParsed,
  ConsoleExternalUpdateParsed,
} from "@/schemas/console";
import { actorFromPartnerOrg } from "@/lib/auth/actorContext";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requirePartnerPermission } from "@/lib/auth/tenantContext";
import { invitationService } from "@/services/users/invitationService";
import { recordAudit } from "@/services/audit/auditService";
import { partnerStaffService } from "@/services/console/partnerStaffService";

function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export const externalInspectorService = {
  async list(ctx: PartnerContext): Promise<ConsoleStaffListDTO> {
    requirePartnerPermission(ctx, "console:external:view");
    return partnerStaffService.list(ctx, { externalOnly: true });
  },

  async get(ctx: PartnerContext, membershipId: string): Promise<ConsoleStaffMemberDTO> {
    requirePartnerPermission(ctx, "console:external:view");
    const member = await partnerStaffService.get(ctx, membershipId);
    if (!member.isExternal) throw notFound("External inspector not found.");
    return member;
  },

  async invite(ctx: PartnerContext, input: ConsoleExternalInviteParsed, req?: Request | null) {
    requirePartnerPermission(ctx, "console:external:manage");
    if (parseDate(input.commissionedTo) < parseDate(input.commissionedFrom)) {
      throw unprocessable("Commission end must be on or after start.", { field: "commissionedTo" });
    }

    const result = await invitationService.createPartnerInvite(
      ctx,
      {
        email: input.email,
        name: input.name,
        appRole: "inspector",
        external: {
          commissionedFrom: input.commissionedFrom,
          commissionedTo: input.commissionedTo,
          liabilityUntil: input.liabilityUntil,
          liabilitySumEur: input.liabilitySumEur,
        },
      },
      req,
    );

    await recordAudit({
      actor: actorFromPartnerOrg(ctx),
      resource: "org_membership",
      resourceId: input.email,
      action: "create",
      summary: `Invited external inspector ${input.email}`,
      after: {
        commissionedFrom: input.commissionedFrom,
        commissionedTo: input.commissionedTo,
        liabilityUntil: input.liabilityUntil,
      },
    });

    return result;
  },

  async update(
    ctx: PartnerContext,
    membershipId: string,
    input: ConsoleExternalUpdateParsed,
  ): Promise<ConsoleStaffMemberDTO> {
    requirePartnerPermission(ctx, "console:external:manage");
    return runWithoutTenantAsync(async () => {
      const membership = await prisma.orgMembership.findFirst({
        where: { id: membershipId, organisationId: ctx.organisationId, isExternal: true },
      });
      if (!membership) throw notFound("External inspector not found.");

      await prisma.orgMembership.update({
        where: { id: membershipId },
        data: {
          ...(input.commissionedFrom
            ? { commissionedFrom: parseDate(input.commissionedFrom) }
            : {}),
          ...(input.commissionedTo ? { commissionedTo: parseDate(input.commissionedTo) } : {}),
          ...(input.liabilityUntil ? { liabilityUntil: parseDate(input.liabilityUntil) } : {}),
          ...(input.liabilitySumEur !== undefined
            ? { liabilitySumEur: input.liabilitySumEur }
            : {}),
          ...(input.validTo !== undefined
            ? {
                validTo:
                  input.validTo && input.validTo.trim()
                    ? parseDate(input.validTo)
                    : null,
              }
            : {}),
        },
      });

      await recordAudit({
        actor: actorFromPartnerOrg(ctx),
        resource: "org_membership",
        resourceId: membershipId,
        action: "update",
        summary: "Updated external inspector commission",
      });

      return partnerStaffService.get(ctx, membershipId);
    });
  },
};
