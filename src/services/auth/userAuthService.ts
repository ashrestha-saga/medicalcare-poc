import type { ClinicSessionUser, PartnerSessionUser, SessionUser, UserRole } from "@/interfaces/session";
import type { PartnerAppRole } from "@/interfaces/management";
import { DEFAULT_USER_ROLE, USER_ROLES } from "@/constants/roles";
import { unauthorized } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export function toClinicSessionUser(row: {
  id: string;
  name: string;
  role: string;
  tenantId: string;
  tenant?: { name: string } | null;
}): ClinicSessionUser {
  const role = (USER_ROLES.includes(row.role as UserRole) ? row.role : DEFAULT_USER_ROLE) as UserRole;
  return {
    id: row.id,
    name: row.name,
    accountKind: "clinic",
    role,
    tenantId: row.tenantId,
    companyName: row.tenant?.name ?? null,
  };
}

/** @deprecated Prefer toClinicSessionUser — kept for call sites during migration. */
export function toSessionUser(row: {
  id: string;
  name: string;
  role: string;
  tenantId: string;
  tenant?: { name: string } | null;
}): SessionUser {
  return toClinicSessionUser(row);
}

function toPartnerSessionUser(row: {
  id: string;
  name: string;
  organisationId: string;
  organisationName: string;
  appRole: string;
}): PartnerSessionUser {
  return {
    id: row.id,
    name: row.name,
    accountKind: "partner",
    organisationId: row.organisationId,
    organisationName: row.organisationName,
    appRole: row.appRole as PartnerAppRole,
    companyName: row.organisationName,
  };
}

async function activeMembershipFor(userId: string, now: Date) {
  return prisma.orgMembership.findFirst({
    where: {
      userId,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    include: { organisation: { select: { id: true, name: true } } },
    orderBy: { validFrom: "asc" },
  });
}

export const userAuthService = {
  async authenticate(
    email: string,
    password: string,
  ): Promise<{ user: ClinicSessionUser; tenantName: string; totpEnabled: boolean }> {
    const normalized = email.trim().toLowerCase();
    const row = await prisma.user.findFirst({
      where: { email: normalized, active: true, accountKind: "clinic" },
      include: { tenant: { select: { name: true } } },
    });
    if (!row || !verifyPassword(password, row.passwordHash)) {
      throw unauthorized("Invalid email or password.");
    }
    if (!row.tenantId || !row.role || !row.tenant) {
      throw unauthorized("Clinic account is incomplete.");
    }
    const user = toClinicSessionUser({
      id: row.id,
      name: row.name,
      role: row.role,
      tenantId: row.tenantId,
      tenant: row.tenant,
    });
    return {
      user,
      tenantName: row.tenant.name,
      totpEnabled: Boolean(row.totpEnabled && row.totpSecretEnc),
    };
  },

  async authenticatePartner(
    email: string,
    password: string,
  ): Promise<{ user: PartnerSessionUser; organisationName: string }> {
    const normalized = email.trim().toLowerCase();
    const row = await prisma.user.findFirst({
      where: { email: normalized, active: true, accountKind: "partner" },
    });
    if (!row || !verifyPassword(password, row.passwordHash)) {
      throw unauthorized("Invalid email or password.");
    }

    const membership = await activeMembershipFor(row.id, new Date());
    if (!membership) {
      throw unauthorized("No active organisation membership for this account.");
    }

    const user = toPartnerSessionUser({
      id: row.id,
      name: row.name,
      organisationId: membership.organisation.id,
      organisationName: membership.organisation.name,
      appRole: membership.appRole,
    });
    return { user, organisationName: membership.organisation.name };
  },

  async getById(id: string): Promise<SessionUser | null> {
    const row = await prisma.user.findFirst({
      where: { id, active: true },
      include: { tenant: { select: { name: true } } },
    });
    if (!row) return null;

    if (row.accountKind === "partner") {
      const membership = await activeMembershipFor(row.id, new Date());
      if (!membership) return null;
      return toPartnerSessionUser({
        id: row.id,
        name: row.name,
        organisationId: membership.organisation.id,
        organisationName: membership.organisation.name,
        appRole: membership.appRole,
      });
    }

    if (!row.tenantId || !row.role || !row.tenant) return null;
    return toClinicSessionUser({
      id: row.id,
      name: row.name,
      role: row.role,
      tenantId: row.tenantId,
      tenant: row.tenant,
    });
  },
};
