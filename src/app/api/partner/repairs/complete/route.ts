import {
  requireActingContext,
  requirePermission,
  withTenantStore,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { requireRepairsEnabled } from "@/lib/features/repairs";
import { prisma } from "@/lib/prisma";
import { completeRepairSchema } from "@/schemas/repairs";
import { completeRepairFromRun } from "@/services/repairs/repairCompleteService";

/** POST /api/partner/repairs/complete — R11 fold K-REP into MaintenanceEvent. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "inspections:perform");
      const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { featureFlags: true },
      });
      requireRepairsEnabled(tenant?.featureFlags);
      const input = completeRepairSchema.parse(await req.json().catch(() => ({})));
      const result = await completeRepairFromRun(ctx, input);
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
