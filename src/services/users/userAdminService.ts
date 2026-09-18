import type { AdminUserDTO, TenantContext } from "@/interfaces";
import type { UserRole } from "@/interfaces/session";
import { DEFAULT_USER_ROLE, USER_ROLES } from "@/constants/roles";
import { requirePermission } from "@/lib/auth/tenantContext";
import { conflict, notFound, unauthorized, unprocessable } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import type { CreateUserInput, ResetUserPasswordInput, UpdateUserInput } from "@/schemas/user";

function toAdminUserDTO(row: {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AdminUserDTO {
  const role = (USER_ROLES.includes(row.role as UserRole) ? row.role : DEFAULT_USER_ROLE) as UserRole;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const userAdminService = {
  async list(ctx: TenantContext, q?: string): Promise<AdminUserDTO[]> {
    requirePermission(ctx, "users:view");
    const needle = q?.trim().toLowerCase();
    const rows = await prisma.user.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(needle
          ? {
              OR: [
                { email: { contains: needle } },
                { name: { contains: needle } },
                { role: { contains: needle } },
              ],
            }
          : {}),
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return rows.map(toAdminUserDTO);
  },

  async create(ctx: TenantContext, input: CreateUserInput): Promise<AdminUserDTO> {
    requirePermission(ctx, "users:create");
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { tenantId: ctx.tenantId, email },
      select: { id: true },
    });
    if (existing) throw conflict("A user with this email already exists.");

    const row = await prisma.user.create({
      data: {
        tenantId: ctx.tenantId,
        email,
        name: input.name.trim(),
        role: input.role,
        passwordHash: hashPassword(input.password),
        active: input.active ?? true,
      },
    });
    return toAdminUserDTO(row);
  },

  async update(ctx: TenantContext, userId: string, input: UpdateUserInput): Promise<AdminUserDTO> {
    requirePermission(ctx, "users:update");
    const row = await prisma.user.findFirst({
      where: { id: userId, tenantId: ctx.tenantId },
    });
    if (!row) throw notFound("User not found.");

    if (row.id === ctx.user.id) {
      if (!input.active) throw unprocessable("You cannot deactivate your own account.");
      if (input.role !== row.role) throw unprocessable("You cannot change your own role.");
    }

    if (row.role === "superadmin" && input.role !== "superadmin") {
      const otherAdmins = await prisma.user.count({
        where: {
          tenantId: ctx.tenantId,
          role: "superadmin",
          active: true,
          id: { not: row.id },
        },
      });
      if (otherAdmins === 0) {
        throw unprocessable("Cannot remove the last active Superadmin.");
      }
    }

    if (row.role === "superadmin" && row.active && !input.active) {
      const otherAdmins = await prisma.user.count({
        where: {
          tenantId: ctx.tenantId,
          role: "superadmin",
          active: true,
          id: { not: row.id },
        },
      });
      if (otherAdmins === 0) {
        throw unprocessable("Cannot deactivate the last active Superadmin.");
      }
    }

    const updated = await prisma.user.update({
      where: { id: row.id },
      data: {
        name: input.name.trim(),
        role: input.role,
        active: input.active,
      },
    });
    return toAdminUserDTO(updated);
  },

  async remove(ctx: TenantContext, userId: string): Promise<void> {
    requirePermission(ctx, "users:delete");
    if (userId === ctx.user.id) throw unprocessable("You cannot delete your own account.");

    const row = await prisma.user.findFirst({
      where: { id: userId, tenantId: ctx.tenantId },
    });
    if (!row) throw notFound("User not found.");

    if (row.role === "superadmin" && row.active) {
      const otherAdmins = await prisma.user.count({
        where: {
          tenantId: ctx.tenantId,
          role: "superadmin",
          active: true,
          id: { not: row.id },
        },
      });
      if (otherAdmins === 0) {
        throw unprocessable("Cannot delete the last active Superadmin.");
      }
    }

    await prisma.user.delete({ where: { id: row.id } });
  },

  async resetPassword(ctx: TenantContext, userId: string, input: ResetUserPasswordInput): Promise<void> {
    requirePermission(ctx, "users:resetpassword");
    const admin = await prisma.user.findFirst({
      where: { id: ctx.user.id, tenantId: ctx.tenantId },
      select: { passwordHash: true },
    });
    if (!admin || !verifyPassword(input.adminPassword, admin.passwordHash)) {
      throw unauthorized("Admin password is incorrect.");
    }

    const row = await prisma.user.findFirst({
      where: { id: userId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!row) throw notFound("User not found.");

    await prisma.user.update({
      where: { id: row.id },
      data: { passwordHash: hashPassword(input.newPassword) },
    });
  },
};

