import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { evidenceService } from "@/services/registration/evidenceService";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/registration/drafts/[id]/evidence */
export async function GET(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const acting = await requireActingContext(req);
    return await withTenantStore(acting, async () => {
      correlationId = acting.correlationId;
      const { id } = await ctx.params;
      const items = await evidenceService.list(acting, id);
      return Response.json(
        { items },
        { headers: { "x-correlation-id": acting.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/registration/drafts/[id]/evidence — upload / record evidence for a prerequisite. */
export async function POST(req: Request, ctx: Ctx) {
  let correlationId: string | undefined;
  try {
    const acting = await requireActingContext(req);
    return await withTenantStore(acting, async () => {
      correlationId = acting.correlationId;
      const { id } = await ctx.params;
      const body = (await req.json()) as {
        prerequisiteCode?: string;
        evidenceKind?: "confirmation" | "document" | "third_party";
        dataUrl?: string | null;
        externalRecordRef?: string | null;
        issuedBy?: string | null;
        issuedAt?: string | null;
        validUntil?: string | null;
      };
      const item = await evidenceService.upsert(acting, id, {
        prerequisiteCode: body.prerequisiteCode ?? "",
        evidenceKind: body.evidenceKind ?? "document",
        dataUrl: body.dataUrl,
        externalRecordRef: body.externalRecordRef,
        issuedBy: body.issuedBy,
        issuedAt: body.issuedAt,
        validUntil: body.validUntil,
      });
      return Response.json(item, {
        status: 201,
        headers: { "x-correlation-id": acting.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
