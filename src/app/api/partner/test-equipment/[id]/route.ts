import { requirePartnerContext, withTenantBypass } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { updateTestEquipmentSchema } from "@/schemas/pruefpartner";
import { testEquipmentService } from "@/services/pruefpartner/testEquipmentService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/partner/test-equipment/[id] */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    const { id } = await params;
    return await withTenantBypass(async () => {
      correlationId = ctx.correlationId;
      const [item, classes, assignees] = await Promise.all([
        testEquipmentService.get(ctx, id),
        testEquipmentService.listClasses(ctx),
        testEquipmentService.listAssignees(ctx),
      ]);
      return Response.json(
        { item, classes, assignees },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** PATCH /api/partner/test-equipment/[id] */
export async function PATCH(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    const { id } = await params;
    return await withTenantBypass(async () => {
      correlationId = ctx.correlationId;
      const body = updateTestEquipmentSchema.parse(await req.json());
      const item = await testEquipmentService.update(ctx, id, body);
      return Response.json({ item }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
