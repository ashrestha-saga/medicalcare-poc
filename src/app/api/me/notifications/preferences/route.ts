import { withNotificationActorStore } from "@/lib/auth/notificationActor";
import { errorResponse } from "@/lib/errors";
import { notificationPreferencesSchema } from "@/schemas/notifications";
import { notificationService } from "@/services/notifications/notificationService";

/** GET/PATCH /api/me/notifications/preferences — UserPreference scope=notifications key=mail. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    return await withNotificationActorStore(req, async (actor) => {
      correlationId = actor.correlationId;
      const preferences = await notificationService.getPreferences(actor);
      return Response.json({ preferences }, { headers: { "x-correlation-id": actor.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function PATCH(req: Request) {
  let correlationId: string | undefined;
  try {
    return await withNotificationActorStore(req, async (actor) => {
      correlationId = actor.correlationId;
      const input = notificationPreferencesSchema.parse(await req.json().catch(() => ({})));
      const preferences = await notificationService.setPreferences(actor, input);
      return Response.json({ preferences }, { headers: { "x-correlation-id": actor.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
