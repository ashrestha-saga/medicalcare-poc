import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { auditService } from "@/services/audit/auditService";

/** GET /api/audit/resources/:resource/:id — per-entity timeline (audit:view). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { resource, id } = await params;
      const events = await auditService.listForResource(ctx, resource, id);
      return Response.json({ events }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
      return errorResponse(error, correlationId);
  }
}

