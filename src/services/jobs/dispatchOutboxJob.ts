import { prisma } from "@/lib/prisma";
import { logger, errorMessage } from "@/lib/logger";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { dispatchService } from "@/services/dispatch/dispatchService";
import { toServiceRequestDTO } from "@/services/shared/mappers";

type RetryPolicy = { maxAttempts?: number; backoffMs?: number };

function parseRetryPolicy(raw: string | null | undefined): Required<RetryPolicy> {
  let maxAttempts = 3;
  let backoffMs = 2000;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as RetryPolicy;
      if (typeof parsed.maxAttempts === "number" && parsed.maxAttempts > 0) {
        maxAttempts = Math.min(parsed.maxAttempts, 10);
      }
      if (typeof parsed.backoffMs === "number" && parsed.backoffMs >= 0) {
        backoffMs = parsed.backoffMs;
      }
    } catch {
      /* keep defaults */
    }
  }
  return { maxAttempts, backoffMs };
}

export type DispatchOutboxResult = {
  claimed: number;
  delivered: number;
  retried: number;
  dead: number;
};

/**
 * OPS-02 — process pending DispatchOutbox rows whose nextAttemptAt has passed.
 */
export async function runDispatchOutboxJob(now = new Date(), limit = 50): Promise<DispatchOutboxResult> {
  return runWithoutTenantAsync(async () => {
    const due = await prisma.dispatchOutbox.findMany({
      where: {
        state: { in: ["pending", "processing"] },
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
      include: {
        target: true,
        serviceRequest: {
          include: {
            statusEvents: { orderBy: { changedAt: "asc" } },
            attachments: true,
            dispatchRecords: true,
            duty: true,
            executorOrg: true,
          },
        },
      },
    });

    let delivered = 0;
    let retried = 0;
    let dead = 0;

    for (const row of due) {
      await prisma.dispatchOutbox.update({
        where: { id: row.id },
        data: { state: "processing" },
      });

      const policy = parseRetryPolicy(row.target.retryPolicy);
      const dto = toServiceRequestDTO(row.serviceRequest);
      const executorOrgId = row.serviceRequest.executorOrgId ?? row.target.executorOrgId ?? "";

      try {
        const outcomes = await dispatchService.dispatch(
          dto,
          row.tenantId,
          row.correlationId ?? `outbox-${row.id}`,
          null,
          {
            executorOrgId,
            updateState: false,
            targetIds: [row.targetId],
            skipOutboxEnqueue: true,
          },
        );
        const hit = outcomes.find((o) => o.targetId === row.targetId);
        if (hit?.result.success) {
          await prisma.dispatchOutbox.update({
            where: { id: row.id },
            data: {
              state: "delivered",
              attemptCount: { increment: 1 },
              lastError: null,
            },
          });
          delivered++;
        } else {
          const attempts = row.attemptCount + 1;
          const err = hit?.result.error ?? "dispatch failed";
          if (attempts >= policy.maxAttempts) {
            await prisma.dispatchOutbox.update({
              where: { id: row.id },
              data: {
                state: "dead",
                attemptCount: attempts,
                lastError: err.slice(0, 500),
              },
            });
            dead++;
          } else {
            await prisma.dispatchOutbox.update({
              where: { id: row.id },
              data: {
                state: "pending",
                attemptCount: attempts,
                nextAttemptAt: new Date(now.getTime() + policy.backoffMs * attempts),
                lastError: err.slice(0, 500),
              },
            });
            retried++;
          }
        }
      } catch (error) {
        const attempts = row.attemptCount + 1;
        const err = errorMessage(error);
        if (attempts >= policy.maxAttempts) {
          await prisma.dispatchOutbox.update({
            where: { id: row.id },
            data: { state: "dead", attemptCount: attempts, lastError: err.slice(0, 500) },
          });
          dead++;
        } else {
          await prisma.dispatchOutbox.update({
            where: { id: row.id },
            data: {
              state: "pending",
              attemptCount: attempts,
              nextAttemptAt: new Date(now.getTime() + policy.backoffMs * attempts),
              lastError: err.slice(0, 500),
            },
          });
          retried++;
        }
        logger.warn("dispatch.outbox.attempt_failed", { outboxId: row.id, error: err });
      }
    }

    return { claimed: due.length, delivered, retried, dead };
  });
}
