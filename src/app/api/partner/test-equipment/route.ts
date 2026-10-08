import { requirePartnerContext, requirePartnerPermission, withTenantBypass } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createTestEquipmentSchema } from "@/schemas/pruefpartner";
import { testEquipmentService } from "@/services/pruefpartner/testEquipmentService";

/** GET /api/partner/test-equipment */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "testequipment:manage", "console:organisation:view");
      correlationId = ctx.correlationId;
      const url = new URL(req.url);
      const classCode = url.searchParams.get("classCode") ?? undefined;
      const items = await testEquipmentService.list(ctx, classCode);
      return Response.json({ items }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/partner/test-equipment */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      correlationId = ctx.correlationId;
      const body = createTestEquipmentSchema.parse(await req.json());
      const item = await testEquipmentService.create(ctx, body);
      return Response.json(
        { item },
        { status: 201, headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
