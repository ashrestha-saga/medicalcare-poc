import { withNotificationActorStore } from "@/lib/auth/notificationActor";
import { errorResponse } from "@/lib/errors";
import { notificationService } from "@/services/notifications/notificationService";

/** POST /api/me/notifications/:id/done */
export async function POST(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    return await withNotificationActorStore(req, async (actor) => {
      correlationId = actor.correlationId;
      const { id } = await ctxParams.params;
      const notification = await notificationService.markDone(actor, id);
      return Response.json({ notification }, { headers: { "x-correlation-id": actor.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
