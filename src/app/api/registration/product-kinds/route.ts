import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { listProductKinds } from "@/services/registration/productKinds";

/** GET /api/registration/product-kinds */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const kinds = await listProductKinds();
    return Response.json({ kinds }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
