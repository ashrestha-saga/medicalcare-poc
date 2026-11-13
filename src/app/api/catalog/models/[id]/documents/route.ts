import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { publishModelDocumentSchema } from "@/schemas/catalogModel";
import { modelDocumentService } from "@/services/catalog/modelDocumentService";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const documents = await modelDocumentService.listForModel(ctx, id);
      return Response.json(
        { documents },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = publishModelDocumentSchema.parse(await req.json().catch(() => ({})));
      const document = await modelDocumentService.publish(ctx, {
        deviceModelId: id,
        kind: input.kind,
        revisionLabel: input.revisionLabel,
        language: input.language,
        validFrom: input.validFrom ?? undefined,
        dataUrl: input.dataUrl,
        externalUrl: input.externalUrl,
        fieldSafetyActionId: input.fieldSafetyActionId,
      });
      return Response.json(
        { document },
        { status: 201, headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
