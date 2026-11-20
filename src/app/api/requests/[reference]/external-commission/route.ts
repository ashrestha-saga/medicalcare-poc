import { z } from "zod";
import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { svExternalService } from "@/services/radiation/svExternalService";

type Ctx = { params: Promise<{ reference: string }> };

const schema = z.object({
  externalOrgName: z.string().trim().min(1).max(300),
  externalCommissionedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** POST /api/requests/:reference/external-commission — R40 mark SV as Fremdleistung. */
export async function POST(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { reference } = await ctxParams.params;
      const input = schema.parse(await req.json());
      const result = await svExternalService.commission(ctx, reference, input);
      return Response.json(
        {
          request: {
            reference: result.reference,
            fulfilment: result.fulfilment,
            externalOrgName: result.externalOrgName,
            externalCommissionedAt: result.externalCommissionedAt?.toISOString().slice(0, 10) ?? null,
          },
        },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
