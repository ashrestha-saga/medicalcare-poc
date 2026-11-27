import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { captureRoutineCheckSchema } from "@/schemas/routineChecks";
import { routineCheckService } from "@/services/routines/routineCheckService";

/** GET/POST /api/devices/:id/routine-checks — list / capture IFU function checks (E105). */
export async function GET(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const { id } = await ctxParams.params;
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const [checks, definitions] = await Promise.all([
        routineCheckService.listForDevice(ctx, id),
        routineCheckService.definitionsForDevice(ctx, id),
      ]);
      return Response.json(
        { checks, definitions },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const { id } = await ctxParams.params;
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = captureRoutineCheckSchema.parse(await req.json().catch(() => ({})));
      const check = await routineCheckService.capture(ctx, id, input);
      return Response.json(
        { check },
        { status: 201, headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
