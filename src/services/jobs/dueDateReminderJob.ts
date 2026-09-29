import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";

export const REMINDER_STAGES = ["T-90", "T-30", "T-7", "due", "overdue"] as const;
export type ReminderStage = (typeof REMINDER_STAGES)[number];

const STAGE_ORDER: ReminderStage[] = ["T-90", "T-30", "T-7", "due", "overdue"];

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
 * Delivery is stubbed as structured log + status=sent (mail adapter can replace later).
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
        logger.info("duty.reminder.dispatch", {
          tenantId: duty.tenantId,
          deviceDutyId: duty.id,
          stage,
          dutyKey: duty.dutyKey,
          title: duty.title,
          dueAt: duty.dueAt.toISOString().slice(0, 10),
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
