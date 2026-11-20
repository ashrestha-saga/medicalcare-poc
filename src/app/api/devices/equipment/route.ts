import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createEquipmentSchema } from "@/schemas/radiationDguv";
import { equipmentInventoryService } from "@/services/inventory/equipmentInventoryService";

/** POST /api/devices/equipment — create Betriebsmittel (E86, flag radiation_dguv). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = createEquipmentSchema.parse(await req.json());
      const device = await equipmentInventoryService.create(ctx, input);
      return Response.json(
        { device },
        { status: 201, headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
