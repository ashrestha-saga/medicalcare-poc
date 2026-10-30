import { prisma } from "@/lib/prisma";

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** Shared overdue filter — matches the due-dates board (`suspendedAt: null`). */
export function overdueDutyWhere(today = startOfTodayUtc()) {
  return {
    applicable: true as const,
    suspendedAt: null,
    dueAt: { lt: today },
  };
}

export async function countOverdueDuties(): Promise<number> {
  return prisma.deviceDuty.count({ where: overdueDutyWhere() });
}

export async function countDatedDuties(): Promise<number> {
  return prisma.deviceDuty.count({
    where: { applicable: true, suspendedAt: null, dueAt: { not: null } },
  });
}
