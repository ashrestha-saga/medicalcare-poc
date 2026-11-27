import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createRoutineDefinitionSchema } from "@/schemas/routineChecks";
import { routineCheckService } from "@/services/routines/routineCheckService";

/** GET/POST /api/routine-checks/definitions — tenant routine definitions (E105). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const defs = await routineCheckService.listDefinitions(ctx);
      return Response.json({ definitions: defs }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = createRoutineDefinitionSchema.parse(await req.json().catch(() => ({})));
      const definition = await routineCheckService.createDefinition(ctx, input);
      return Response.json(
        { definition },
        { status: 201, headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
