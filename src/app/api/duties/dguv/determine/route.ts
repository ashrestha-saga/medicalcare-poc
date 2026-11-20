import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dguvBatchDeterminationSchema } from "@/schemas/radiationDguv";
import { dguvDeterminationService } from "@/services/duties/dguvDeterminationService";

/** POST /api/duties/dguv/determine — batch DGUV determination (E85). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const body = dguvBatchDeterminationSchema.parse(await req.json());
      const out = await dguvDeterminationService.determineBatch(
        ctx,
        body.deviceIds,
        body.determination,
      );
      return Response.json(out, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** GET /api/duties/dguv/determine — list devices without determination. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const pending = await dguvDeterminationService.listWithoutDetermination(ctx);
      return Response.json({ pending }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}