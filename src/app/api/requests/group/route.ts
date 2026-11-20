import { z } from "zod";
import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { collectiveOrderService } from "@/services/orders/collectiveOrderService";

const schema = z.object({
  siteId: z.string().min(1),
  deviceInstanceIds: z.array(z.string().min(1)).min(1).max(100),
  serviceType: z.string().min(1).default("DGUV"),
  note: z.string().max(2000).optional().nullable(),
  visitId: z.string().optional().nullable(),
});

/** POST /api/requests/group — create Sammelauftrag (RD26). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = schema.parse(await req.json());
      const result = await collectiveOrderService.createGroup(ctx, input);
      return Response.json({ result }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
