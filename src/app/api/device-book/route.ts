import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createBookEntrySchema } from "@/schemas/k10";
import { deviceBookService } from "@/services/deviceBook/deviceBookService";

export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const url = new URL(req.url);
      const deviceInstanceId = url.searchParams.get("deviceInstanceId") ?? undefined;
      const rows = await deviceBookService.list(ctx, deviceInstanceId);
      return Response.json({ entries: rows }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const input = createBookEntrySchema.parse(await req.json().catch(() => ({})));
      const entry = await deviceBookService.create(ctx, input);
      return Response.json({ entry }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
