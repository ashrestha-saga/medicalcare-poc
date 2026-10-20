import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createSiteSchema } from "@/schemas/site";
import { locationService } from "@/services/location/locationService";

/** GET /api/sites?q=&mpsb=missing|appointed — tenant sites + areas (auth). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    correlationId = ctx.correlationId;
    return await withTenantStore(ctx, async () => {
      const params = new URL(req.url).searchParams;
      const q = params.get("q") ?? undefined;
      const mpsbRaw = params.get("mpsb");
      const mpsb = mpsbRaw === "missing" || mpsbRaw === "appointed" ? mpsbRaw : undefined;
      const sites =
        q || mpsb
          ? await locationService.list(ctx, { q, mpsb })
          : await locationService.listSites(ctx.tenantId);
      return Response.json({ sites }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/sites — create location (locations:create). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    correlationId = ctx.correlationId;
    return await withTenantStore(ctx, async () => {
      const input = createSiteSchema.parse(await req.json());
      const site = await locationService.create(ctx, input);
      return Response.json({ site }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
