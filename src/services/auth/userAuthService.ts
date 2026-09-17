import type { SessionUser, UserRole } from "@/interfaces/session";
import { DEFAULT_USER_ROLE, USER_ROLES } from "@/constants/roles";
import { unauthorized } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export function toSessionUser(row: {
  id: string;
  name: string;
  role: string;
  tenantId: string;
  tenant?: { name: string } | null;
}): SessionUser {
  const role = (USER_ROLES.includes(row.role as UserRole) ? row.role : DEFAULT_USER_ROLE) as UserRole;
  return {
    id: row.id,
    name: row.name,
    role,
    tenantId: row.tenantId,
    companyName: row.tenant?.name ?? null,
  };
}

export const userAuthService = {
  async authenticate(
    email: string,
    password: string,
  ): Promise<{ user: SessionUser; tenantName: string; totpEnabled: boolean }> {
    const normalized = email.trim().toLowerCase();
    const row = await prisma.user.findFirst({
      where: { email: normalized, active: true },
      include: { tenant: { select: { name: true } } },
    });
    if (!row || !verifyPassword(password, row.passwordHash)) {
      throw unauthorized("Invalid email or password.");
    }
    const user = toSessionUser(row);
    return {
      user,
      tenantName: row.tenant.name,
      totpEnabled: Boolean(row.totpEnabled && row.totpSecretEnc),
    };
  },

  async getById(id: string): Promise<SessionUser | null> {
    const row = await prisma.user.findFirst({
      where: { id, active: true },
      include: { tenant: { select: { name: true } } },
    });
    return row ? toSessionUser(row) : null;
  },
};
