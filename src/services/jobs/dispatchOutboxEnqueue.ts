import { prisma } from "@/lib/prisma";

/** Enqueue a failed target for later retry (idempotent per request+target). */
export async function enqueueDispatchFailure(input: {
  tenantId: string;
  serviceRequestId: string;
  targetId: string;
  correlationId: string;
  error?: string | null;
}): Promise<void> {
  await prisma.dispatchOutbox.upsert({
    where: {
      serviceRequestId_targetId: {
        serviceRequestId: input.serviceRequestId,
        targetId: input.targetId,
      },
    },
    create: {
      tenantId: input.tenantId,
      serviceRequestId: input.serviceRequestId,
      targetId: input.targetId,
      state: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(Date.now() + 2000),
      lastError: input.error?.slice(0, 500) ?? null,
      correlationId: input.correlationId,
    },
    update: {
      state: "pending",
      nextAttemptAt: new Date(Date.now() + 2000),
      lastError: input.error?.slice(0, 500) ?? null,
      correlationId: input.correlationId,
    },
  });
}
