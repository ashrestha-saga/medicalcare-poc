import type { NotificationDigestResultDTO } from "@/interfaces/notifications";
import { NOTIFICATION_PREF_MAIL_KEY, NOTIFICATION_PREF_SCOPE } from "@/constants/notifications";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * E107 — daily digest. Lists users whose mail preference is `daily` and counts their
 * unread, not-yet-mailed notifications. Delivery is stubbed (structured log only) — the
 * SMTP adapter (resolveSmtp) can replace the log call; `mailedAt` is intentionally left
 * untouched until a real send succeeds so nothing is lost.
 */
export async function runNotificationDigestJob(): Promise<NotificationDigestResultDTO> {
  return runWithoutTenantAsync(async () => {
    const prefs = await prisma.userPreference.findMany({
      where: { scope: NOTIFICATION_PREF_SCOPE, key: NOTIFICATION_PREF_MAIL_KEY },
      select: { userId: true, value: true },
    });
    const dailyUserIds = prefs
      .filter((p) => {
        const v = p.value;
        const mode =
          v && typeof v === "object" && !Array.isArray(v)
            ? (v as Record<string, unknown>).mode
            : v;
        return mode === "daily";
      })
      .map((p) => p.userId);

    let notifications = 0;
    let skipped = 0;
    for (const userId of dailyUserIds) {
      const pending = await prisma.userNotification.count({
        where: { userId, state: "unread", mailedAt: null },
      });
      if (pending === 0) {
        skipped += 1;
        continue;
      }
      notifications += pending;
      logger.info("notification.digest.stub", { userId, pending });
    }
    return { users: dailyUserIds.length, notifications, mailed: 0, skipped };
  });
}
