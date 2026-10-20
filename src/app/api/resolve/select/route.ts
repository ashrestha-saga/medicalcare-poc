import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { parseIdentifier } from "@/lib/gs1";
import { resolveSelectSchema } from "@/schemas/resolve";
import { resolveService } from "@/services/resolve/resolveService";

/** Bind a GTIN candidate pick to one inventory exemplar (work-area checked). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = resolveSelectSchema.parse(await req.json());
      const raw = input.raw?.trim();
      const identifier = raw
        ? parseIdentifier(raw)
        : ({ raw: input.deviceId, kind: "inventory" as const, text: input.deviceId });
      const result = await resolveService.selectDevice(ctx, input.deviceId, identifier);
      return Response.json(result, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
