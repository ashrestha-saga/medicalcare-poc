import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { modelDocumentService } from "@/services/catalog/modelDocumentService";
import { z } from "zod";

const publishSchema = z.object({
  kind: z
    .enum(["ifu", "service_manual", "safety_notice", "work_instruction", "other"])
    .optional(),
  revisionLabel: z.string().trim().min(1),
  language: z.string().trim().min(1).optional(),
  validFrom: z.string().optional().nullable(),
  dataUrl: z.string().trim().max(8_000_000).optional().nullable(),
  externalUrl: z.string().trim().optional().nullable(),
  fieldSafetyActionId: z.string().optional().nullable(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
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
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = publishSchema.parse(await req.json().catch(() => ({})));
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
