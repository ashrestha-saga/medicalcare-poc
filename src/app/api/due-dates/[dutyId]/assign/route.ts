import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createDutyAssignmentSchema } from "@/schemas/dueDates";
import { dueDatesService } from "@/services/dueDates/dueDatesService";

type RouteContext = { params: Promise<{ dutyId: string }> };

/** POST /api/due-dates/[dutyId]/assign — open a service request from a due duty. */
export async function POST(req: Request, ctx: RouteContext) {
  let correlationId: string | undefined;
  try {
    const auth = await requireTenantContext(req);
    return await withTenantStore(auth, async () => {
      correlationId = auth.correlationId;
      const { dutyId } = await ctx.params;
      const body = await req.json().catch(() => ({}));
      const input = createDutyAssignmentSchema.parse(body ?? {});
      const result = await dueDatesService.createAssignment(auth, dutyId, input);
      return Response.json(result, {
        status: result.created ? 201 : 200,
        headers: { "x-correlation-id": auth.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
