import { withNotificationActorStore } from "@/lib/auth/notificationActor";
import { errorResponse } from "@/lib/errors";
import { notificationListQuerySchema } from "@/schemas/notifications";
import { notificationService } from "@/services/notifications/notificationService";

/** GET /api/me/notifications?state=open|unread|all — person inbox (E107). Clinic or partner. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    return await withNotificationActorStore(req, async (actor) => {
      correlationId = actor.correlationId;
      const params = Object.fromEntries(new URL(req.url).searchParams);
      const query = notificationListQuerySchema.parse(params);
      const result = await notificationService.list(actor, query);
      return Response.json(result, { headers: { "x-correlation-id": actor.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/me/notifications — mark all unread notifications as read. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    return await withNotificationActorStore(req, async (actor) => {
      correlationId = actor.correlationId;
      const result = await notificationService.markAllRead(actor);
      return Response.json(result, { headers: { "x-correlation-id": actor.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
