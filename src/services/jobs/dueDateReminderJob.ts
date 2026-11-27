import { notificationDedup } from "@/constants/notifications";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { notifyService } from "@/services/notifications/notifyService";

export const REMINDER_STAGES = ["T-90", "T-30", "T-7", "due", "overdue"] as const;
export type ReminderStage = (typeof REMINDER_STAGES)[number];

const STAGE_ORDER: ReminderStage[] = ["T-90", "T-30", "T-7", "due", "overdue"];

const STAGE_LABEL: Record<ReminderStage, string> = {
  "T-90": "in 90 Tagen",
  "T-30": "in 30 Tagen",
  "T-7": "in 7 Tagen",
  due: "heute fällig",
  overdue: "überfällig",
};

/** Days until dueAt → stage that should be active (most severe matching). */
export function stageForDueDate(dueAt: Date, now = new Date()): ReminderStage | null {
  const due = Date.UTC(dueAt.getUTCFullYear(), dueAt.getUTCMonth(), dueAt.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.floor((due - today) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "due";
  if (days <= 7) return "T-7";
  if (days <= 30) return "T-30";
  if (days <= 90) return "T-90";
  return null;
}

function stageRank(stage: string | null | undefined): number {
  if (!stage) return -1;
  return STAGE_ORDER.indexOf(stage as ReminderStage);
}

export type DueDateReminderResult = {
  scanned: number;
  created: number;
  sent: number;
  skipped: number;
};

/**
 * OPS-01 — evaluate DeviceDuty due dates, create DutyReminder rows, advance notifyStage.
 * On dispatch: UserNotification via notifyService (responsible user, else clinic admins).
 */
export async function runDueDateReminderJob(now = new Date()): Promise<DueDateReminderResult> {
  return runWithoutTenantAsync(async () => {
    const duties = await prisma.deviceDuty.findMany({
      where: {
        applicable: true,
        suspendedAt: null,
        dueAt: { not: null },
      },
      select: {
        id: true,
        tenantId: true,
        dueAt: true,
        notifyStage: true,
        dutyKey: true,
        title: true,
        deviceInstanceId: true,
        deviceInstance: {
          select: {
            inventoryNumber: true,
            responsibleUserId: true,
          },
        },
      },
    });

    let created = 0;
    let sent = 0;
    let skipped = 0;

    for (const duty of duties) {
      if (!duty.dueAt) continue;
      const stage = stageForDueDate(duty.dueAt, now);
      if (!stage) {
        skipped++;
        continue;
      }
      if (stageRank(duty.notifyStage) >= stageRank(stage)) {
        skipped++;
        continue;
      }

      const reminder = await prisma.dutyReminder.upsert({
        where: { deviceDutyId_stage: { deviceDutyId: duty.id, stage } },
        create: {
          tenantId: duty.tenantId,
          deviceDutyId: duty.id,
          stage,
          scheduledFor: duty.dueAt,
          status: "pending",
          attemptCount: 0,
        },
        update: {},
      });

      if (reminder.status === "sent") {
        skipped++;
        continue;
      }

      created += reminder.attemptCount === 0 && reminder.status === "pending" ? 1 : 0;

      try {
        const inv = duty.deviceInstance.inventoryNumber;
        const dutyLabel = duty.title ?? duty.dutyKey;
        const dueYmd = duty.dueAt.toISOString().slice(0, 10);
        const title = `Frist ${STAGE_LABEL[stage]}: ${inv}`;
        const body = `${dutyLabel} · fällig ${dueYmd}`;
        const target = {
          type: "device" as const,
          id: duty.deviceInstanceId,
          inventoryNumber: inv,
          tenantId: duty.tenantId,
          focus: "duties" as const,
        };
        const dedup = notificationDedup.dueReminder(duty.id, stage);

        const responsibleId = duty.deviceInstance.responsibleUserId;
        if (responsibleId) {
          await notifyService.pushSafe(
            responsibleId,
            "due_reminder",
            dedup,
            title,
            body,
            target,
            duty.tenantId,
            null,
          );
        } else {
          await notifyService.pushToRoles(
            duty.tenantId,
            ["device_admin", "security_officer"],
            "due_reminder",
            dedup,
            title,
            body,
            target,
            duty.tenantId,
            null,
          );
        }

        logger.info("duty.reminder.dispatch", {
          tenantId: duty.tenantId,
          deviceDutyId: duty.id,
          stage,
          dutyKey: duty.dutyKey,
          title: duty.title,
          dueAt: dueYmd,
          notified: responsibleId ? "responsible" : "roles",
        });
        await prisma.dutyReminder.update({
          where: { id: reminder.id },
          data: {
            status: "sent",
            attemptCount: { increment: 1 },
            sentAt: now,
            lastError: null,
          },
        });
        await prisma.deviceDuty.update({
          where: { id: duty.id },
          data: { notifyStage: stage, lastNotifiedAt: now },
        });
        sent++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.dutyReminder.update({
          where: { id: reminder.id },
          data: {
            status: "failed",
            attemptCount: { increment: 1 },
            lastError: message.slice(0, 500),
          },
        });
        logger.warn("duty.reminder.failed", { deviceDutyId: duty.id, stage, error: message });
      }
    }

    return { scanned: duties.length, created, sent, skipped };
  });
}
