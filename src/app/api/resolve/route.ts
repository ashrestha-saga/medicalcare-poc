import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { parseIdentifier } from "@/lib/gs1";
import { resolveRequestSchema } from "@/schemas/resolve";
import { resolveService } from "@/services/resolve/resolveService";

/** FA-100 — POST /api/resolve: scanner and manual entry both land here. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const input = resolveRequestSchema.parse(await req.json());
    const identifier = parseIdentifier(input.raw); // FA-101 — same parser as the client
    const result = await resolveService.resolve(identifier, ctx.tenantId, ctx.correlationId, ctx.user.id);
    return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
