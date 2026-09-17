import { requireTenantContext } from "@/lib/auth/tenantContext";
import { badRequest, errorResponse } from "@/lib/errors";
import {
  createServiceRequestSchema,
  serviceRequestListScopeSchema,
} from "@/schemas/serviceRequest";
import { serviceRequestService } from "@/services/requests/serviceRequestService";

/** SS-701 — POST /api/service-requests. 201 on create, 200 on idempotent retry, 409 on key reuse. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const input = createServiceRequestSchema.parse(await req.json());
    const result = await serviceRequestService.create(input, ctx);
    return Response.json(result, {
      status: result.created ? 201 : 200,
      headers: { "x-correlation-id": ctx.correlationId },
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** GET /api/service-requests?scope=mine|open|all&state=&limit= */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const url = new URL(req.url);
    const scopeRaw = url.searchParams.get("scope") ?? "mine";
    const scopeParsed = serviceRequestListScopeSchema.safeParse(scopeRaw);
    if (!scopeParsed.success) throw badRequest("scope must be mine, open, or all.");
    const state = url.searchParams.get("state")?.trim() || undefined;
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;
    if (limitRaw && (!Number.isFinite(limit) || (limit ?? 0) < 1)) {
      throw badRequest("limit must be a positive number.");
    }
    const list = await serviceRequestService.list(ctx, {
      scope: scopeParsed.data,
      state,
      limit,
    });
    return Response.json({ requests: list, scope: scopeParsed.data });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
