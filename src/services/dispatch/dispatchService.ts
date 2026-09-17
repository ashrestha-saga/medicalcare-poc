import type {
  DispatchAdapter,
  DispatchOutcome,
  DispatchResult,
  DispatchableServiceRequest,
  ServiceRequestDTO,
  SessionUser,
} from "@/interfaces";
import { env } from "@/lib/env";
import { errorMessage, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { mailDispatchAdapter, webhookDispatchAdapter } from "@/services/adapters/mailDispatchAdapter";
import { oxidHttpDispatchAdapter } from "@/services/adapters/oxidHttpAdapter";
import { oxidMockDispatchAdapter } from "@/services/adapters/oxidMockAdapter";
import { toDispatchTargetDTO } from "@/services/shared/mappers";
import {
  buildServiceDispatchExport,
  contextFromUser,
  formatServiceRequestEmail,
} from "./serviceDispatchExport";

/**
 * SS-702 / SS-703 — adapter registry keyed by DispatchTarget.type.
 * Targets are iterated independently; one failure never blocks another.
 * Adding a target row in the DB requires no code change.
 */
export function buildRegistry(mode = env.oxid.adapterMode): Map<string, DispatchAdapter> {
  const oxid = mode === "http" ? oxidHttpDispatchAdapter : oxidMockDispatchAdapter;
  return new Map<string, DispatchAdapter>([
    ["oxid", oxid],
    ["mail", mailDispatchAdapter],
    ["webhook", webhookDispatchAdapter],
  ]);
}

const DEFAULT_MAIL_TO = "service@plusorder.de";

export function createDispatchService(registry: Map<string, DispatchAdapter> = buildRegistry()) {
  return {
    async dispatch(
      request: ServiceRequestDTO,
      tenantId: string,
      correlationId: string,
      user?: SessionUser | null,
    ): Promise<DispatchOutcome[]> {
      const targets = await prisma.dispatchTarget.findMany({ where: { tenantId, enabled: true } });
      const context = contextFromUser(user);
      const exportBody = await buildServiceDispatchExport(request, context);
      const mailTarget = targets.find((t) => t.type === "mail" && t.endpoint);
      const email = formatServiceRequestEmail(
        exportBody,
        mailTarget?.endpoint?.trim() || DEFAULT_MAIL_TO,
        context,
      );

      const payload: DispatchableServiceRequest = {
        request,
        tenantId,
        correlationId,
        exportBody,
        email,
        context,
      };
      const outcomes: DispatchOutcome[] = [];

      for (const row of targets) {
        const target = toDispatchTargetDTO(row);
        const adapter = registry.get(target.type);
        const maxAttempts = Math.max(1, Math.min(target.retryPolicy?.maxAttempts ?? 1, 5));
        let attempt = 0;
        let result: DispatchResult = adapter
          ? { success: false, error: "not attempted" }
          : { success: false, error: `no adapter registered for target type "${target.type}"` };

        if (adapter) {
          while (attempt < maxAttempts) {
            attempt++;
            try {
              result = await adapter.dispatch(target, payload);
            } catch (error) {
              result = { success: false, error: errorMessage(error) };
            }
            if (result.success) break;
          }
        }

        await prisma.dispatchRecord.create({
          data: {
            serviceRequestId: request.id,
            targetId: target.id,
            target: `${target.type}:${target.name}`,
            success: result.success,
            httpStatus: result.httpStatus ?? null,
            response: result.response ? JSON.stringify(result.response) : null,
            error: result.error ?? null,
            attemptCount: Math.max(attempt, 1),
            correlationId,
          },
        });
        logger.info("dispatch.result", { correlationId, target: target.type, success: result.success, attempts: attempt });
        outcomes.push({ targetId: target.id, target: `${target.type}:${target.name}`, result });
      }

      // FA-601 — the only state we assert ourselves is "transmitted on …", and only
      // when at least one target accepted the request. Failures stay visible as records.
      if (outcomes.length > 0 && outcomes.some((o) => o.result.success)) {
        await prisma.$transaction([
          prisma.serviceRequest.update({ where: { id: request.id }, data: { state: "transmitted" } }),
          prisma.statusEvent.create({
            data: {
              serviceRequestId: request.id,
              state: "transmitted",
              source: "devicecare",
              note: `transmitted to ${outcomes.filter((o) => o.result.success).map((o) => o.target).join(", ")}`,
            },
          }),
        ]);
      }
      return outcomes;
    },
  };
}

export const dispatchService = createDispatchService();
