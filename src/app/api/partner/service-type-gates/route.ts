import { z } from "zod";
import { requirePartnerContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import {
  listServiceTypeGates,
  updateServiceTypeGate,
} from "@/services/gates/serviceTypeGateService";

/** GET /api/partner/service-type-gates */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    correlationId = ctx.correlationId;
    const gates = await listServiceTypeGates(ctx.organisationId);
    return Response.json({ gates }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

const putSchema = z.object({
  serviceType: z.string().min(1),
  overridableBy: z.enum(["none", "service_lead", "management"]),
});

/** PUT /api/partner/service-type-gates — GF only; sv locked. */
export async function PUT(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    correlationId = ctx.correlationId;
    const body = putSchema.parse(await req.json());
    const gate = await updateServiceTypeGate({
      organisationId: ctx.organisationId,
      serviceType: body.serviceType,
      overridableBy: body.overridableBy,
      setBy: ctx.user.name,
      appRole: String(ctx.user.appRole),
    });
    return Response.json({ gate }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
