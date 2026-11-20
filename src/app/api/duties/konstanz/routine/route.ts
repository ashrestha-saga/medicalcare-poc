import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { constancyRoutineCompleteSchema } from "@/schemas/k10";
import { constancyRoutineService } from "@/services/constancy/constancyRoutineService";
import { createAttachmentFromDataUrl } from "@/services/storage/attachmentBlobService";

/** GET /api/duties/konstanz/routine — routine board (due, missing takt, records, KPIs). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const board = await constancyRoutineService.listBoard(ctx);
      return Response.json(board, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/duties/konstanz/routine — E87 clinic constancy routine capture. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const parsed = constancyRoutineCompleteSchema.parse(await req.json());
      const { dataUrl, ...rest } = parsed;
      let attachmentBlobId = rest.attachmentBlobId?.trim() || null;
      if (!attachmentBlobId && dataUrl?.trim()) {
        if (!dataUrl.startsWith("data:")) {
          throw unprocessable("dataUrl must be a data URL", { field: "dataUrl" });
        }
        const blob = await createAttachmentFromDataUrl(prisma, {
          tenantId: ctx.tenantId,
          kind: "constancy_protocol",
          dataUrl: dataUrl.trim(),
        });
        attachmentBlobId = blob.id;
      }
      const result = await constancyRoutineService.complete(ctx, {
        ...rest,
        attachmentBlobId,
      });
      return Response.json({ result }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}