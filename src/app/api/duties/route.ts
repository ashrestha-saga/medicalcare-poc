import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dutyService } from "@/services/registration/dutyService";

/** GET /api/duties — applicable duties due on or before `before` (default +90 days). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const auth = await requireTenantContext(req);
    correlationId = auth.correlationId;
    const url = new URL(req.url);
    const beforeRaw = url.searchParams.get("before");
    const limitRaw = url.searchParams.get("limit");
    let before: Date | undefined;
    if (beforeRaw) {
      const parsed = new Date(beforeRaw);
      if (Number.isNaN(parsed.getTime())) {
        return Response.json(
          { error: { code: "validation_error", message: "Invalid before date.", correlationId } },
          { status: 400, headers: { "x-correlation-id": auth.correlationId } },
        );
      }
      before = parsed;
    }
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const duties = await dutyService.listDue(auth, {
      before,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return Response.json({ duties }, { headers: { "x-correlation-id": auth.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
