import { createHash, randomBytes } from "node:crypto";
import type { PartnerContext, TenantWorkContext } from "@/interfaces";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { actorFromContext, requestMetaFrom } from "@/lib/auth/actorContext";
import { requirePartnerPermission, requirePermission } from "@/lib/auth/tenantContext";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { resolveSmtp, type SmtpOwner } from "@/services/mail/resolveSmtp";
import {
  ensureRoleGrantCache,
  getCachedPermissions,
  samePermissionSet,
  sanitizeClinicPermissions,
} from "@/services/roles/roleGrantsService";
import type { Prisma } from "@prisma/client";
import nodemailer from "nodemailer";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CLINIC_ROLES = new Set(["superadmin", "device_admin", "security_officer", "user"]);

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function redeemBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

async function sendInviteMail(args: {
  to: string;
  redeemUrl: string;
  inviterName: string;
  owner: SmtpOwner;
}) {
  const resolved = await resolveSmtp(args.owner);
  if (!resolved.config) {
    logger.info("invite.email_simulated", {
      to: args.to,
      redeemUrl: args.redeemUrl,
      source: resolved.source,
      forcedSimulate: resolved.forcedSimulate,
    });
    return { simulated: true as const, source: resolved.source };
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
    to: args.to,
    subject: "DeviceCare invitation",
    text: `${args.inviterName} invited you to DeviceCare.\n\nSet your password:\n${args.redeemUrl}\n\nThis link expires in 7 days.`,
  });
  return { simulated: false as const, source: resolved.source };
}

function parseInvitePermissions(raw: Prisma.JsonValue | null | undefined): PermissionSlug[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const cleaned = sanitizeClinicPermissions(raw.map(String));
  return cleaned.length > 0 ? cleaned : null;
}

export const invitationService = {
  async createClinicInvite(
    ctx: TenantWorkContext,
    input: {
      email: string;
      name?: string | null;
      role: string;
      permissions?: string[] | null;
    },
  ) {
    requirePermission(ctx, "users:create");
    await ensureRoleGrantCache();
    const email = input.email.trim().toLowerCase();
    if (!email) throw unprocessable("Email is required.", { field: "email" });
    const role = input.role.trim();
    if (!CLINIC_ROLES.has(role)) throw unprocessable("Invalid role.", { field: "role" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict("A user with this email already exists.");

    let permissionsJson: Prisma.InputJsonValue | undefined;
    if (input.permissions != null) {
      const cleaned = sanitizeClinicPermissions(input.permissions);
      const preset = getCachedPermissions(role as UserRole);
      // Persist only when customized; pure preset → null (role-only on redeem).
      if (!samePermissionSet(cleaned, preset)) {
        permissionsJson = cleaned;
      }
    }

    const token = newToken();
    const row = await prisma.userInvitation.create({
      data: {
        tenantId: ctx.tenantId,
        email,
        name: input.name?.trim() || null,
        role,
        permissions: permissionsJson ?? undefined,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        createdByUserId: ctx.user.id,
      },
    });

    const redeemUrl = `${redeemBaseUrl()}/invite?token=${encodeURIComponent(token)}`;
    const mail = await sendInviteMail({
      to: email,
      redeemUrl,
      inviterName: ctx.user.name,
      owner: { tenantId: ctx.tenantId },
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "user",
      resourceId: row.id,
      action: "create",
      summary: `Invited ${email} as ${role}`,
      after: {
        email,
        role,
        invitationId: row.id,
        permissions: permissionsJson ?? null,
      },
    });

    return {
      id: row.id,
      email: row.email,
      expiresAt: row.expiresAt.toISOString(),
      redeemUrl,
      emailSimulated: mail.simulated,
    };
  },

  async resendClinicInvite(ctx: TenantWorkContext, invitationId: string) {
    requirePermission(ctx, "users:create");
    const inv = await prisma.userInvitation.findFirst({
      where: {
        id: invitationId,
        tenantId: ctx.tenantId,
        acceptedAt: null,
      },
    });
    if (!inv) throw notFound("Invitation not found.");
    if (inv.expiresAt.getTime() < Date.now()) {
      throw unprocessable("Invitation expired. Create a new invite.");
    }

    const token = newToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await prisma.userInvitation.update({
      where: { id: inv.id },
      data: { tokenHash: hashToken(token), expiresAt },
    });

    const redeemUrl = `${redeemBaseUrl()}/invite?token=${encodeURIComponent(token)}`;
    const mail = await sendInviteMail({
      to: inv.email,
      redeemUrl,
      inviterName: ctx.user.name,
      owner: { tenantId: ctx.tenantId },
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "user",
      resourceId: inv.id,
      action: "update",
      summary: `Resent invitation to ${inv.email}`,
      after: { invitationId: inv.id, email: inv.email },
    });

    return {
      id: inv.id,
      email: inv.email,
      expiresAt: expiresAt.toISOString(),
      redeemUrl,
      emailSimulated: mail.simulated,
    };
  },

  async withdrawClinicInvite(ctx: TenantWorkContext, invitationId: string) {
    requirePermission(ctx, "users:delete");
    const inv = await prisma.userInvitation.findFirst({
      where: {
        id: invitationId,
        tenantId: ctx.tenantId,
        acceptedAt: null,
      },
    });
    if (!inv) throw notFound("Invitation not found.");

    await prisma.userInvitation.delete({ where: { id: inv.id } });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "user",
      resourceId: inv.id,
      action: "delete",
      summary: `Withdrew invitation for ${inv.email}`,
      before: { email: inv.email, role: inv.role, invitationId: inv.id },
    });
  },

  async createPartnerInvite(
    ctx: PartnerContext,
    input: { email: string; name?: string | null; appRole: "inspector" | "admin" | "order" },
    req?: Request | null,
  ) {
    requirePartnerPermission(ctx, "console:staff:invite");
    const email = input.email.trim().toLowerCase();
    if (!email) throw unprocessable("Email is required.", { field: "email" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict("A user with this email already exists.");

    const token = newToken();
    // Org-scoped invites have null tenantId — bypass SEC-01 stamp/filter.
    const row = await runWithoutTenantAsync(() =>
      prisma.userInvitation.create({
        data: {
          organisationId: ctx.organisationId,
          email,
          name: input.name?.trim() || null,
          appRole: input.appRole,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
          createdByUserId: ctx.user.id,
        },
      }),
    );

    const redeemUrl = `${redeemBaseUrl()}/invite?token=${encodeURIComponent(token)}`;
    const mail = await sendInviteMail({
      to: email,
      redeemUrl,
      inviterName: ctx.user.name,
      owner: { organisationId: ctx.organisationId },
    });

    const meta = requestMetaFrom(req);
    await recordAudit({
      actor: {
        tenantId: null,
        actorUserId: ctx.user.id,
        actorKind: "partner",
        actorRole: String(ctx.user.appRole),
        actorName: ctx.user.name,
        organisationId: ctx.organisationId,
        organisationName: ctx.user.organisationName,
        serviceContractId: null,
        correlationId: ctx.correlationId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      resource: "user",
      resourceId: row.id,
      action: "create",
      summary: `Invited partner ${email} as ${input.appRole}`,
      after: { email, appRole: input.appRole, invitationId: row.id },
    });

    return {
      id: row.id,
      email: row.email,
      expiresAt: row.expiresAt.toISOString(),
      redeemUrl,
      emailSimulated: mail.simulated,
    };
  },

  async redeem(input: { token: string; password: string; name?: string | null }) {
    const token = input.token.trim();
    const password = input.password;
    if (!token) throw unprocessable("Token is required.", { field: "token" });
    if (!password || password.length < 8) {
      throw unprocessable("Password must be at least 8 characters.", { field: "password" });
    }

    return runWithoutTenantAsync(async () => {
      const invite = await prisma.userInvitation.findFirst({
        where: { tokenHash: hashToken(token) },
      });
      if (!invite) throw notFound("Invitation not found.");
      if (invite.acceptedAt) throw unprocessable("Invitation already used.");
      if (invite.expiresAt.getTime() < Date.now()) throw unprocessable("Invitation expired.");

      const existing = await prisma.user.findUnique({ where: { email: invite.email } });
      if (existing) throw conflict("A user with this email already exists.");

      const displayName = input.name?.trim() || invite.name || invite.email.split("@")[0]!;

      if (invite.tenantId) {
        const snapshot = parseInvitePermissions(invite.permissions);
        const user = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              tenantId: invite.tenantId,
              email: invite.email,
              name: displayName,
              role: invite.role ?? "user",
              accountKind: "clinic",
              passwordHash: hashPassword(password),
              active: true,
            },
          });
          if (snapshot && snapshot.length > 0) {
            await tx.userPermission.createMany({
              data: snapshot.map((permission) => ({
                userId: created.id,
                permission,
              })),
            });
          }
          await tx.userInvitation.update({
            where: { id: invite.id },
            data: { acceptedAt: new Date() },
          });
          return created;
        });
        return { userId: user.id, email: user.email, accountKind: "clinic" as const };
      }

      if (invite.organisationId && invite.appRole) {
        const user = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email: invite.email,
              name: displayName,
              accountKind: "partner",
              role: null,
              passwordHash: hashPassword(password),
              active: true,
            },
          });
          await tx.orgMembership.create({
            data: {
              userId: created.id,
              organisationId: invite.organisationId!,
              appRole: invite.appRole!,
              validFrom: new Date(),
            },
          });
          await tx.userInvitation.update({
            where: { id: invite.id },
            data: { acceptedAt: new Date() },
          });
          return created;
        });
        return { userId: user.id, email: user.email, accountKind: "partner" as const };
      }

      throw unprocessable("Invitation is incomplete.");
    });
  },
};
