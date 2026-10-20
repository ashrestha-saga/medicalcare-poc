import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { authorityNotificationService } from "@/services/authority/authorityNotificationService";
import type { NotificationKind, NotificationState } from "@prisma/client";

export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const url = new URL(req.url);
      const state = url.searchParams.get("state") as NotificationState | null;
      const kind = url.searchParams.get("kind") as NotificationKind | null;
      const incidentId = url.searchParams.get("incidentId") ?? undefined;
      const notifications = await authorityNotificationService.list(ctx, {
        ...(state ? { state } : {}),
        ...(kind ? { kind } : {}),
        ...(incidentId ? { incidentId } : {}),
      });
      return Response.json(
        { notifications },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
