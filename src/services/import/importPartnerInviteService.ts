import { createHash, randomBytes } from "node:crypto";
import type { TenantWorkContext } from "@/interfaces/session";
import { unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { importJobService } from "./importJobService";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type InvitePartnerInput = {
  organisationId?: string;
  newProvider?: { name: string; email: string };
  scope?: {
    drafts?: number;
    modelsUnclassified?: number;
    dutiesWithoutEvidence?: number;
  };
  rightsTemplate?: "inspect_and_maintain" | "inspect_only";
  message?: string;
};

/** E84 — Prüfpartner einladen from import finish. */
export const importPartnerInviteService = {
  async invite(ctx: TenantWorkContext, jobId: string, input: InvitePartnerInput) {
    await importJobService.assertMayImport(ctx);
    await importJobService.get(ctx, jobId);

    const email = input.newProvider?.email || undefined;
    let organisationId = input.organisationId || null;
    let providerName = input.newProvider?.name || "";

    if (organisationId) {
      const org = await prisma.organisation.findFirst({ where: { id: organisationId } });
      if (!org) throw unprocessable("Organisation not found");
      providerName = org.name;
      if (!email) {
        // Prefer org contact email if any membership admin
        const admin = await prisma.orgMembership.findFirst({
          where: { organisationId, appRole: "admin" },
          include: { user: { select: { email: true } } },
        });
        if (!admin?.user.email) throw unprocessable("Provide newProvider.email or org with admin");
      }
    }

    const to = email || (await resolveOrgEmail(organisationId!));
    if (!to) throw unprocessable("Invitee email required");

    const token = randomBytes(32).toString("base64url");
    const invite = await prisma.userInvitation.create({
      data: {
        tenantId: null,
        organisationId,
        email: to.toLowerCase(),
        name: providerName || null,
        appRole: "admin",
        kind: "partner_onboarding",
        invitingTenantId: ctx.tenantId,
        scopeJson: {
          providerName,
          scope: input.scope || {},
          rightsTemplate: input.rightsTemplate || "inspect_and_maintain",
          message: input.message || "",
          importJobId: jobId,
        },
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        createdByUserId: ctx.user.id,
      },
    });

    await recordAudit({
      actor: ctx.actor || {
        tenantId: ctx.tenantId,
        actorUserId: ctx.user.id,
        actorKind: "clinic",
        actorRole: ctx.user.role || null,
        actorName: ctx.user.name,
        organisationId: null,
        organisationName: null,
        serviceContractId: null,
        correlationId: ctx.correlationId || null,
        ip: null,
        userAgent: null,
      },
      resource: "UserInvitation",
      resourceId: invite.id,
      action: "create",
      summary: `Prüfpartner eingeladen — ${to}`,
    });

    return {
      invitationId: invite.id,
      email: to,
      /** Redeem token only returned in non-prod / tests when SMTP simulated. */
      token: process.env.NODE_ENV === "test" ? token : undefined,
      status: "sent",
    };
  },
};

async function resolveOrgEmail(organisationId: string): Promise<string | null> {
  const admin = await prisma.orgMembership.findFirst({
    where: { organisationId, appRole: "admin" },
    include: { user: { select: { email: true } } },
  });
  return admin?.user.email || null;
}

/** Rights template → scope grant slugs for redeem. */
export function rightsTemplateSlugs(
  template: "inspect_and_maintain" | "inspect_only",
): string[] {
  if (template === "inspect_only") {
    return ["inventory:view", "duties:view", "inspections:view", "inspections:perform"];
  }
  return [
    "inventory:view",
    "inventory:update",
    "import:manage",
    "duties:view",
    "inspections:view",
    "inspections:perform",
    "clarifications:view",
  ];
}
