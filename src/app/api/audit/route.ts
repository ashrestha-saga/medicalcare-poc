import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { auditListQuerySchema } from "@/schemas/audit";
import { auditService } from "@/services/audit/auditService";

function queryFrom(req: Request) {
  const url = new URL(req.url);
  return auditListQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
}

/** GET /api/audit — tenant-scoped activity feed (audit:view). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const query = queryFrom(req);
      const result = await auditService.list(ctx, query);
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
      return errorResponse(error, correlationId);
  }
}

