import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { z } from "zod";
import { fieldSafetyRolloutService } from "@/services/console/fieldSafetyRolloutService";

const bodySchema = z.object({
  reference: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(500),
  manufacturer: z.string().trim().min(1).max(200),
  requiredAction: z.string().trim().min(1).max(2000),
  affectedScope: z.string().trim().max(2000).optional(),
  modelLabel: z.string().trim().max(200).optional(),
  dueAt: z.string().trim().nullable().optional(),
  tenantIds: z.array(z.string().trim().min(1)).min(1),
});

/** GET /api/partner/field-safety/rollout — grouped by rolloutKey. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "fieldsafety:rollout", "console:customers:view");
      correlationId = ctx.correlationId;
      const data = await fieldSafetyRolloutService.list(ctx);
      return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/partner/field-safety/rollout */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "fieldsafety:rollout");
      correlationId = ctx.correlationId;
      const input = bodySchema.parse(await req.json().catch(() => ({})));
      const result = await fieldSafetyRolloutService.rollout(ctx, input);
      return Response.json(result, {
        status: 201,
        headers: { "x-correlation-id": ctx.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
