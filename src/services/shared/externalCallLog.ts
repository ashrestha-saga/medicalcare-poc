import { hashIdentifier } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * NFA-807 / Section 30 — every external query is recorded, with the identifier
 * hashed. Writes a DB row *and* a structured log line; never throws.
 */
export interface ExternalCallEntry {
  system: "beudamed" | "oxid";
  operation: string;
  identifier: string;
  tenantId?: string | null;
  correlationId?: string;
  durationMs: number;
  cacheHit: boolean;
  success: boolean;
  httpStatus?: number | null;
  error?: string | null;
}

export async function recordExternalCall(entry: ExternalCallEntry): Promise<void> {
  const identifierHash = hashIdentifier(entry.identifier);
  logger.info("external.call", { ...entry, identifier: undefined, identifierHash });
  try {
    await prisma.externalCallLog.create({
      data: {
        system: entry.system,
        operation: entry.operation,
        identifierHash,
        tenantId: entry.tenantId ?? null,
        correlationId: entry.correlationId ?? null,
        durationMs: Math.round(entry.durationMs),
        cacheHit: entry.cacheHit,
        success: entry.success,
        httpStatus: entry.httpStatus ?? null,
        error: entry.error ?? null,
      },
    });
  } catch (error) {
    logger.warn("external.call_log_failed", { error: error instanceof Error ? error.message : String(error) });
  }
}
