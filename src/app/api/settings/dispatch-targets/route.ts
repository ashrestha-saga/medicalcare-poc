import { z } from "zod";
import { requirePermission, requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { dispatchTargetsSettingsService } from "@/services/settings/dispatchTargetsSettingsService";

/** GET /api/settings/dispatch-targets — executor channels (settings:view). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const dispatch = await dispatchTargetsSettingsService.list(ctx);
      return Response.json({ dispatch }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

const patchSchema = z.object({
  targetId: z.string().trim().min(1),
  enabled: z.boolean(),
});

/** PATCH /api/settings/dispatch-targets — enable/disable a channel (settings:smtp). */
export async function PATCH(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "settings:smtp");
      const body = patchSchema.parse(await req.json());
      const channel = await dispatchTargetsSettingsService.setEnabled(
        ctx,
        body.targetId,
        body.enabled,
      );
      return Response.json({ channel }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
