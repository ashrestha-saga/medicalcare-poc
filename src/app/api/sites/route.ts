import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createSiteSchema } from "@/schemas/site";
import { locationService } from "@/services/location/locationService";

/** GET /api/sites?q= — tenant sites + areas (auth). Admin search when locations:view. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const q = new URL(req.url).searchParams.get("q") ?? undefined;
    // Form consumers call without q; admin list may pass q (still tenant-scoped).
    const sites = q
      ? await locationService.list(ctx, q)
      : await locationService.listSites(ctx.tenantId);
    return Response.json({ sites }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/sites — create location (locations:create). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const input = createSiteSchema.parse(await req.json());
    const site = await locationService.create(ctx, input);
    return Response.json({ site }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
