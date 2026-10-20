import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createReprocessingCheckSchema } from "@/schemas/k10";
import { reprocessingEvidenceService } from "@/services/reprocessingEvidence/reprocessingEvidenceService";

export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const params = new URL(req.url).searchParams;
      const cadence = params.get("cadence") ?? undefined;
      const scopeRaw = params.get("scope") ?? undefined;
      const scopes = scopeRaw
        ? scopeRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      const openToday = params.get("openToday") === "1" || params.get("openToday") === "true";

      if (openToday) {
        const [open, refs] = await Promise.all([
          reprocessingEvidenceService.listOpenDailyChecks(ctx, scopes),
          reprocessingEvidenceService.listRefChecks(ctx, {
            cadence: cadence ?? "daily",
            scopes,
          }),
        ]);
        return Response.json(
          { checks: [], refs, openToday: open },
          { headers: { "x-correlation-id": ctx.correlationId } },
        );
      }

      const [checks, refs] = await Promise.all([
        reprocessingEvidenceService.listChecks(ctx, { cadence, scopes }),
        reprocessingEvidenceService.listRefChecks(ctx, { cadence, scopes }),
      ]);
      return Response.json({ checks, refs }, { headers: { "x-correlation-id": ctx.correlationId } });
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
      const input = createReprocessingCheckSchema.parse(await req.json().catch(() => ({})));
      const check = await reprocessingEvidenceService.recordCheck(ctx, input);
      return Response.json({ check }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
