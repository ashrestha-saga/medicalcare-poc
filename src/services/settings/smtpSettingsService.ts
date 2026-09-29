import type { PartnerContext, TenantContext } from "@/interfaces";
import { actorFromPartnerOrg, actorFromTenant } from "@/lib/auth/actorContext";
import { encryptSecret } from "@/lib/crypto/secretBox";
import { unprocessable } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requirePartnerPermission, requirePermission } from "@/lib/auth/tenantContext";
import { recordAudit } from "@/services/audit/auditService";
import { resolveSmtp, type SmtpOwner } from "@/services/mail/resolveSmtp";
import { getCachedPartnerConsolePermissions } from "@/services/roles/roleGrantsService";
import type { UpsertSmtpSettingsInput } from "@/schemas/smtpSettings";
import nodemailer from "nodemailer";

export type SmtpSettingsPublicDTO = {
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  from: string | null;
  passwordSet: boolean;
  updatedAt: string | null;
};

function ownerWhere(owner: SmtpOwner) {
  if ("tenantId" in owner && owner.tenantId) return { tenantId: owner.tenantId };
  return { organisationId: owner.organisationId };
}

function assertSingleOwner(owner: SmtpOwner): void {
  const hasTenant = Boolean("tenantId" in owner && owner.tenantId);
  const hasOrg = Boolean("organisationId" in owner && owner.organisationId);
  if (hasTenant === hasOrg) {
    throw unprocessable("SMTP settings require exactly one of tenantId or organisationId.");
  }
}

function toPublic(row: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromAddr: string;
  passEnc: string;
  updatedAt: Date;
} | null): SmtpSettingsPublicDTO {
  if (!row) {
    return {
      configured: false,
      host: null,
      port: null,
      secure: false,
      user: null,
      from: null,
      passwordSet: false,
      updatedAt: null,
    };
  }
  return {
    configured: true,
    host: row.host,
    port: row.port,
    secure: row.secure,
    user: row.user,
    from: row.fromAddr,
    passwordSet: Boolean(row.passEnc),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const smtpSettingsService = {
  async get(owner: SmtpOwner): Promise<SmtpSettingsPublicDTO> {
    assertSingleOwner(owner);
    const row = await prisma.smtpSettings.findFirst({ where: ownerWhere(owner) });
    return toPublic(row);
  },

  async upsert(
    owner: SmtpOwner,
    input: UpsertSmtpSettingsInput,
    opts: { actorUserId: string; tenantCtx?: TenantContext; partnerCtx?: PartnerContext },
  ): Promise<SmtpSettingsPublicDTO> {
    assertSingleOwner(owner);
    const existing = await prisma.smtpSettings.findFirst({ where: ownerWhere(owner) });
    const password = input.password?.trim() ?? "";
    if (!existing && !password) {
      throw unprocessable("Password is required when configuring SMTP for the first time.", {
        field: "password",
      });
    }
    const passEnc = password
      ? encryptSecret(password)
      : existing!.passEnc;

    const data = {
      host: input.host.trim(),
      port: input.port,
      secure: input.secure,
      user: input.user.trim(),
      fromAddr: input.from.trim(),
      passEnc,
      updatedByUserId: opts.actorUserId,
    };

    const row = existing
      ? await prisma.smtpSettings.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.smtpSettings.create({
          data: {
            ...data,
            ...("tenantId" in owner && owner.tenantId
              ? { tenantId: owner.tenantId }
              : { organisationId: owner.organisationId }),
          },
        });

    const actor = opts.partnerCtx
      ? actorFromPartnerOrg(opts.partnerCtx)
      : opts.tenantCtx
        ? actorFromTenant(opts.tenantCtx)
        : null;

    if (actor) {
      await recordAudit({
        actor,
        resource: "settings",
        resourceId: row.id,
        action: existing ? "update" : "create",
        summary: existing ? "Updated SMTP settings" : "Configured SMTP settings",
        before: existing
          ? {
              host: existing.host,
              port: existing.port,
              secure: existing.secure,
              user: existing.user,
              from: existing.fromAddr,
              passwordSet: true,
            }
          : undefined,
        after: {
          host: row.host,
          port: row.port,
          secure: row.secure,
          user: row.user,
          from: row.fromAddr,
          passwordSet: true,
        },
        required: true,
      });
    }

    return toPublic(row);
  },

  async sendTest(
    owner: SmtpOwner,
    to: string,
  ): Promise<{ simulated: boolean; source: string; to: string }> {
    assertSingleOwner(owner);
    const resolved = await resolveSmtp(owner);
    if (!resolved.config) {
      logger.info("smtp.test_simulated", { to, source: resolved.source });
      return { simulated: true, source: resolved.source, to };
    }
    const smtp = resolved.config;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    await transporter.sendMail({
      from: smtp.from,
      to,
      subject: "DeviceCare SMTP test",
      text: "This is a test message from DeviceCare SMTP settings.",
    });
    return { simulated: false, source: resolved.source, to };
  },

  /** Clinic Settings — permission-gated wrappers. */
  async getForClinic(ctx: TenantContext): Promise<SmtpSettingsPublicDTO & { canManage: boolean }> {
    requirePermission(ctx, "settings:view");
    const dto = await this.get({ tenantId: ctx.tenantId });
    const canManage = Boolean(ctx.permissions?.includes("settings:smtp"));
    return { ...dto, canManage };
  },

  async upsertForClinic(ctx: TenantContext, input: UpsertSmtpSettingsInput) {
    requirePermission(ctx, "settings:smtp");
    return this.upsert({ tenantId: ctx.tenantId }, input, {
      actorUserId: ctx.user.id,
      tenantCtx: ctx,
    });
  },

  async testForClinic(ctx: TenantContext, to?: string) {
    requirePermission(ctx, "settings:smtp");
    let recipient = to?.trim().toLowerCase() ?? "";
    if (!recipient) {
      const user = await prisma.user.findFirst({
        where: { id: ctx.user.id },
        select: { email: true },
      });
      recipient = user?.email?.toLowerCase() ?? "";
    }
    if (!recipient) throw unprocessable("Recipient email is required.", { field: "to" });
    return this.sendTest({ tenantId: ctx.tenantId }, recipient);
  },

  /** Partner organisation Settings — permission-gated wrappers. */
  async getForOrganisation(
    ctx: PartnerContext,
  ): Promise<SmtpSettingsPublicDTO & { canManage: boolean }> {
    requirePartnerPermission(ctx, "console:settings:view");
    const dto = await this.get({ organisationId: ctx.organisationId });
    const canManage = getCachedPartnerConsolePermissions(ctx.user.appRole).includes(
      "console:settings:smtp",
    );
    return { ...dto, canManage };
  },

  async upsertForOrganisation(ctx: PartnerContext, input: UpsertSmtpSettingsInput) {
    requirePartnerPermission(ctx, "console:settings:smtp");
    return this.upsert({ organisationId: ctx.organisationId }, input, {
      actorUserId: ctx.user.id,
      partnerCtx: ctx,
    });
  },

  async testForOrganisation(ctx: PartnerContext, to?: string) {
    requirePartnerPermission(ctx, "console:settings:smtp");
    let recipient = to?.trim().toLowerCase() ?? "";
    if (!recipient) {
      const user = await prisma.user.findFirst({
        where: { id: ctx.user.id },
        select: { email: true },
      });
      recipient = user?.email?.toLowerCase() ?? "";
    }
    if (!recipient) throw unprocessable("Recipient email is required.", { field: "to" });
    return this.sendTest({ organisationId: ctx.organisationId }, recipient);
  },
};
