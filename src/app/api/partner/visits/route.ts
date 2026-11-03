import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { z } from "zod";
import { serviceVisitService } from "@/services/console/serviceVisitService";

const upsertSchema = z.object({
  id: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1),
  siteId: z.string().trim().min(1).nullable().optional(),
  plannedAt: z.string().trim().nullable().optional(),
  startedAt: z.string().trim().nullable().optional(),
  completedAt: z.string().trim().nullable().optional(),
  technicianUserId: z.string().trim().min(1).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

/** GET /api/partner/visits */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "visits:manage", "console:disposition:view");
      correlationId = ctx.correlationId;
      const data = await serviceVisitService.list(ctx);
      return Response.json(data, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/partner/visits — create or update a ServiceVisit. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "visits:manage");
      correlationId = ctx.correlationId;
      const body = upsertSchema.parse(await req.json().catch(() => ({})));
      const visit = await serviceVisitService.upsert(ctx, body);
      return Response.json(
        { visit },
        {
          status: body.id ? 200 : 201,
          headers: { "x-correlation-id": ctx.correlationId },
        },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
