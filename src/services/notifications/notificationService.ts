/**
 * E107 — read side of the person inbox ("Für mich") + mail preference.
 */
import type { Prisma } from "@prisma/client";
import type {
  NotificationKind,
  NotificationListDTO,
  NotificationMailMode,
  NotificationPreferencesDTO,
  NotificationState,
  NotificationTarget,
  UserNotificationDTO,
} from "@/interfaces/notifications";
import type { NotificationActor, NotificationDoor } from "@/lib/auth/notificationActor";
import {
  NOTIFICATION_LIST_LIMIT,
  NOTIFICATION_PREF_MAIL_KEY,
  NOTIFICATION_PREF_SCOPE,
  hrefForNotificationTarget,
} from "@/constants/notifications";
import { notFound } from "@/lib/errors";
import { requireNotifications } from "@/lib/features/addendum6";
import { prisma } from "@/lib/prisma";
import type { NotificationListQuery } from "@/schemas/notifications";

async function assertEnabled(actor: NotificationActor) {
  // Partner personal inbox is always on (rows are written without clinic flags).
  if (actor.door === "partner") return;
  if (!actor.tenantId) {
    requireNotifications(undefined);
    return;
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: actor.tenantId },
    select: { featureFlags: true },
  });
  requireNotifications(tenant?.featureFlags);
}

function parseTarget(raw: unknown): NotificationTarget | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.type !== "string" || typeof o.id !== "string" || !o.id) return null;
  const target: NotificationTarget = { type: o.type, id: o.id };
  if (typeof o.inventoryNumber === "string" && o.inventoryNumber.trim()) {
    target.inventoryNumber = o.inventoryNumber.trim();
  }
  if (typeof o.tenantId === "string" && o.tenantId.trim()) {
    target.tenantId = o.tenantId.trim();
  }
  if (typeof o.focus === "string" && o.focus.trim()) {
    target.focus = o.focus.trim();
  }
  return target;
}

function toDTO(
  r: {
    id: string;
    kind: string;
    title: string;
    body: string | null;
    targetJson: unknown;
    tenantId?: string | null;
    state: string;
    createdAt: Date;
    readAt: Date | null;
    doneAt: Date | null;
  },
  door: NotificationDoor,
): UserNotificationDTO {
  const target = parseTarget(r.targetJson);
  return {
    id: r.id,
    kind: r.kind as NotificationKind,
    title: r.title,
    body: r.body,
    target,
    href: hrefForNotificationTarget(target, {
      door,
      kind: r.kind,
      tenantId: r.tenantId,
    }),
    state: r.state as NotificationState,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt?.toISOString() ?? null,
    doneAt: r.doneAt?.toISOString() ?? null,
  };
}

export async function readMailPreference(userId: string): Promise<NotificationMailMode> {
  const row = await prisma.userPreference.findUnique({
    where: {
      userId_scope_key: {
        userId,
        scope: NOTIFICATION_PREF_SCOPE,
        key: NOTIFICATION_PREF_MAIL_KEY,
      },
    },
    select: { value: true },
  });
  const v = row?.value;
  const mode =
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>).mode
      : typeof v === "string"
        ? v
        : null;
  return mode === "daily" ? "daily" : "off";
}

export const notificationService = {
  async list(actor: NotificationActor, query: NotificationListQuery): Promise<NotificationListDTO> {
    await assertEnabled(actor);
    const where: Prisma.UserNotificationWhereInput = { userId: actor.userId };
    if (query.state === "unread") where.state = "unread";
    else if (query.state === "open") where.state = { in: ["unread", "read"] };
    const [rows, unreadCount, mail] = await Promise.all([
      prisma.userNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit ?? NOTIFICATION_LIST_LIMIT,
      }),
      prisma.userNotification.count({ where: { userId: actor.userId, state: "unread" } }),
      readMailPreference(actor.userId),
    ]);
    return {
      notifications: rows.map((r) => toDTO(r, actor.door)),
      unreadCount,
      preferences: { mail },
    };
  },

  async unreadCount(userId: string): Promise<number> {
    return prisma.userNotification.count({ where: { userId, state: "unread" } });
  },

  async markRead(actor: NotificationActor, id: string): Promise<UserNotificationDTO> {
    await assertEnabled(actor);
    const row = await prisma.userNotification.findFirst({
      where: { id, userId: actor.userId },
    });
    if (!row) throw notFound("Notification not found.");
    if (row.state !== "unread") return toDTO(row, actor.door);
    const updated = await prisma.userNotification.update({
      where: { id },
      data: { state: "read", readAt: new Date() },
    });
    return toDTO(updated, actor.door);
  },

  async markDone(actor: NotificationActor, id: string): Promise<UserNotificationDTO> {
    await assertEnabled(actor);
    const row = await prisma.userNotification.findFirst({
      where: { id, userId: actor.userId },
    });
    if (!row) throw notFound("Notification not found.");
    if (row.state === "done") return toDTO(row, actor.door);
    const now = new Date();
    const updated = await prisma.userNotification.update({
      where: { id },
      data: { state: "done", doneAt: now, readAt: row.readAt ?? now },
    });
    return toDTO(updated, actor.door);
  },

  async markAllRead(actor: NotificationActor): Promise<{ updated: number }> {
    await assertEnabled(actor);
    const res = await prisma.userNotification.updateMany({
      where: { userId: actor.userId, state: "unread" },
      data: { state: "read", readAt: new Date() },
    });
    return { updated: res.count };
  },

  async getPreferences(actor: NotificationActor): Promise<NotificationPreferencesDTO> {
    await assertEnabled(actor);
    return { mail: await readMailPreference(actor.userId) };
  },

  async setPreferences(
    actor: NotificationActor,
    input: NotificationPreferencesDTO,
  ): Promise<NotificationPreferencesDTO> {
    await assertEnabled(actor);
    await prisma.userPreference.upsert({
      where: {
        userId_scope_key: {
          userId: actor.userId,
          scope: NOTIFICATION_PREF_SCOPE,
          key: NOTIFICATION_PREF_MAIL_KEY,
        },
      },
      create: {
        userId: actor.userId,
        organisationId: actor.door === "partner" ? actor.organisationId : null,
        scope: NOTIFICATION_PREF_SCOPE,
        key: NOTIFICATION_PREF_MAIL_KEY,
        value: { mode: input.mail },
      },
      update: { value: { mode: input.mail } },
    });
    return { mail: input.mail };
  },
};
