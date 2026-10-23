import type { TenantContext, TenantWorkContext } from "@/interfaces";
import { clarificationService } from "@/services/clarifications/clarificationService";

/**
 * Klärliste device count (A3 / E11 option A).
 * Counts devices with open inventory issues or deferred DeviceClarification rows —
 * same predicate as `/api/clarifications` and the Bestand badge (`list`).
 */
export async function countKlarlisteDevices(ctx: TenantWorkContext): Promise<number> {
  return clarificationService.countOpenCases(ctx as TenantContext);
}
