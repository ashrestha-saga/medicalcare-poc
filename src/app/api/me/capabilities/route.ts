import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { resolveCapabilities } from "@/services/auth/capabilitiesService";

/** GET /api/me/capabilities — permission slugs + menu modules for the signed-in user. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    return Response.json(resolveCapabilities(ctx.user.role), {
      headers: { "x-correlation-id": ctx.correlationId },
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
