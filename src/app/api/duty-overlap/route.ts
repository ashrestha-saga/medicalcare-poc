import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createDutyOverlapSchema } from "@/schemas/k10";
import { dutyOverlapService } from "@/services/duties/dutyOverlapService";

export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const [decisions, devices] = await Promise.all([
        dutyOverlapService.list(ctx),
        dutyOverlapService.listCandidateDevices(ctx),
      ]);
      return Response.json(
        { decisions, devices },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = createDutyOverlapSchema.parse(await req.json().catch(() => ({})));
      const decision = await dutyOverlapService.decide(ctx, input);
      return Response.json({ decision }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
