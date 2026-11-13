import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { replacementSchema } from "@/schemas/repairs";
import { assignReplacement } from "@/services/repairs/loanerService";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/devices/:id/replacement — R14 loaner. */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = replacementSchema.parse(await req.json().catch(() => ({})));
      const result = await assignReplacement(ctx, id, input);
      return Response.json(result, {
        status: 201,
        headers: { "x-correlation-id": ctx.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
