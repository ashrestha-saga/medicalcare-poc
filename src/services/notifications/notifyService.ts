/**
 * E107 / RD46 — write side of the person inbox.
 * One row per (userId, dedupKey); repeated pushes bump an existing row back to the top.
 */
import type { Prisma } from "@prisma/client";
import type { NotificationKind, NotificationTarget } from "@/interfaces/notifications";
import { isNotificationsEnabled } from "@/lib/features/addendum6";
import { logger, errorMessage } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";

async function tenantAllows(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return true;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true },
  });
  return isNotificationsEnabled(tenant?.featureFlags);
}

type PushArgs = [
  userId: string,
  kind: NotificationKind,
  dedupKey: string,
  title: string,
  body: string | null,
  target: NotificationTarget | null,
  tenantId?: string | null,
  organisationId?: string | null,
];
type ClinicRoleSlug = "device_admin" | "security_officer" | "superadmin" | "user";
type PushTail = PushArgs extends [unknown, ...infer R] ? R : never;

export const notifyService = {
  /**
   * Create or refresh a notification. Returns null when the tenant has notifications off.
   * - unread row exists → createdAt (+ text) refreshed, stays unread
   * - read/done row exists → re-opened as unread (same topic recurred)
   */
  async push(...args: PushArgs): Promise<{ id: string } | null> {
    const [userId, kind, dedupKey, title, body, target, tenantId, organisationId] = args;
    if (!(await tenantAllows(tenantId))) return null;
    const now = new Date();
    const targetJson = (target ?? {}) as unknown as Prisma.InputJsonValue;
    // UserNotification is cross-tenant by design (nullable tenantId) — not tenant-guarded.
    const row = await prisma.userNotification.upsert({
      where: { userId_dedupKey: { userId, dedupKey } },
      create: {
        userId,
        kind,
        dedupKey,
        title,
        body,
        targetJson,
        tenantId: tenantId ?? null,
        organisationId: organisationId ?? null,
        state: "unread",
        createdAt: now,
      },
      update: {
        kind,
        title,
        body,
        targetJson,
        state: "unread",
        createdAt: now,
        readAt: null,
        doneAt: null,
        mailedAt: null,
      },
      select: { id: true },
    });
    return row;
  },

  /** Fire-and-forget variant — never throws into business flows (seal, import, acknowledge). */
  async pushSafe(...args: PushArgs): Promise<void> {
    try {
      await notifyService.push(...args);
    } catch (error) {
      logger.warn("notify.push_failed", { error: errorMessage(error), kind: args[1], dedupKey: args[2] });
    }
  },

  /** Active clinic users of a tenant holding one of the given roles. */
  async clinicRecipients(
    tenantId: string,
    roles: ClinicRoleSlug[],
  ): Promise<string[]> {
    const users = await runWithoutTenantAsync(() =>
      prisma.user.findMany({
        where: { tenantId, active: true, accountKind: "clinic", role: { in: roles } },
        select: { id: true },
      }),
    );
    return users.map((u) => u.id);
  },

  /** Push the same notification to many users (deduped per user). */
  async pushToMany(userIds: string[], ...rest: PushTail): Promise<void> {
    const [kind, dedupKey, title, body, target, tenantId, organisationId] = rest;
    for (const userId of [...new Set(userIds)]) {
      await notifyService.pushSafe(userId, kind, dedupKey, title, body, target, tenantId, organisationId);
    }
  },

  /** Resolve clinic users by role and push to each; never throws. */
  async pushToRoles(
    tenantId: string,
    roles: ClinicRoleSlug[],
    ...rest: PushTail
  ): Promise<void> {
    try {
      const userIds = await notifyService.clinicRecipients(tenantId, roles);
      await notifyService.pushToMany(userIds, ...rest);
    } catch (error) {
      logger.warn("notify.push_roles_failed", { error: errorMessage(error), kind: rest[0] });
    }
  },
};
