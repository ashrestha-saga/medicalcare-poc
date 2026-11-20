import { z } from "zod";
import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { scanDguvService } from "@/services/scan/scanDguvService";

type Ctx = { params: Promise<{ id: string }> };

const submitSchema = z.object({
  dutyId: z.string().min(1),
  result: z.enum(["passed", "failed"]),
  performedBy: z.string().trim().min(1).max(200).optional().nullable(),
  labelNumber: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}-\d{4}-\d{4}$/)
    .optional()
    .nullable(),
  measurements: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        value: z.number(),
        unit: z.string().trim().min(1),
        limit: z.number().optional().nullable(),
        withinLimit: z.boolean(),
      }),
    )
    .min(1)
    .max(10),
  note: z.string().trim().max(2000).optional().nullable(),
  performedAt: z.string().trim().optional().nullable(),
});

/** GET /api/scan/devices/:id/dguv — open DGUV own_check for Scan. */
export async function GET(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await ctxParams.params;
      const dguv = await scanDguvService.listOpen(ctx, id);
      return Response.json({ dguv }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/scan/devices/:id/dguv — record DGUV own check. */
export async function POST(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await ctxParams.params;
      const input = submitSchema.parse(await req.json());
      const result = await scanDguvService.submit(ctx, id, input);
      return Response.json({ result }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
