import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse, notFound } from "@/lib/errors";
import { parseIdentifier } from "@/lib/gs1";
import { errorMessage, logger } from "@/lib/logger";
import { beudamedService } from "@/services/beudamed/beudamedService";

/**
 * GET /api/beudamed/:udiDi — proxied, cached BEUDAMED lookup.
 * Returns the mapped DeviceModelDTO only; the raw payload never leaves the server.
 * Failures are 404 (unknown) or 503 (upstream) — never a stack trace.
 */
export async function GET(req: Request, { params }: { params: Promise<{ udiDi: string }> }) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const { udiDi } = await params;
    const identifier = parseIdentifier(udiDi);
    if (!identifier.udiDi) throw notFound("Not a valid UDI-DI / GTIN.");
    try {
      const hit = await beudamedService.resolve(identifier, ctx.tenantId, ctx.correlationId);
      if (!hit) throw notFound("No BEUDAMED record for this identifier.");
      return Response.json({ model: hit.model, source: { system: "beudamed", fetchedAt: hit.fetchedAt.toISOString(), cached: hit.cached } });
    } catch (error) {
      if (error instanceof Error && error.name === "AppError") throw error;
      logger.warn("beudamed.proxy_failed", { correlationId, error: errorMessage(error) });
      return Response.json(
        { error: { code: "downstream_unavailable", message: "We couldn't identify this device automatically. Please enter the device information manually.", correlationId } },
        { status: 503 },
      );
    }
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
