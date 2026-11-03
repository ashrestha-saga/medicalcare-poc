import { requireActingContext, withTenantStore, requirePermission } from "@/lib/auth/tenantContext";
import { errorResponse, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createAttachmentFromDataUrl } from "@/services/storage/attachmentBlobService";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  kind: z.enum(["inspector", "institution"]),
  signerName: z.string().trim().max(200).nullable().optional(),
  signerRole: z.string().trim().max(200).nullable().optional(),
  signedAt: z.string().trim().nullable().optional(),
  absent: z.boolean().optional(),
  absentReason: z.string().trim().max(2000).nullable().optional(),
  /** Optional canvas PNG data URL — stored as AttachmentBlob, linked via blobId. */
  imageDataUrl: z.string().trim().max(2_000_000).nullable().optional(),
});

/** PUT /api/partner/inspection-runs/[id]/signatures — D10 seal signatures. */
export async function PUT(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      requirePermission(ctx, "inspections:perform", "inspection:sign");
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = schema.parse(await req.json().catch(() => ({})));
      if (input.absent && !input.absentReason?.trim()) {
        throw unprocessable("Absence reason required.", { field: "absentReason" });
      }
      const run = await prisma.inspectionRun.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { id: true, dutyPerformanceId: true },
      });
      if (!run) throw notFound("Inspection run not found.");
      if (run.dutyPerformanceId) throw unprocessable("Run already sealed.");

      let blobId: string | null = null;
      if (!input.absent && input.imageDataUrl?.startsWith("data:image/")) {
        const blob = await createAttachmentFromDataUrl(prisma, {
          tenantId: ctx.tenantId,
          kind: input.kind === "inspector" ? "unterschrift_techniker" : "gegenzeichnung",
          dataUrl: input.imageDataUrl,
        });
        blobId = blob.id;
      }

      const row = await prisma.inspectionSignature.upsert({
        where: { runId_kind: { runId: id, kind: input.kind } },
        create: {
          runId: id,
          kind: input.kind,
          signerName: input.signerName ?? null,
          signerRole: input.signerRole ?? null,
          signedAt: input.absent ? null : input.signedAt ? new Date(input.signedAt) : new Date(),
          absent: Boolean(input.absent),
          absentReason: input.absentReason ?? null,
          blobId,
        },
        update: {
          signerName: input.signerName ?? null,
          signerRole: input.signerRole ?? null,
          signedAt: input.absent ? null : input.signedAt ? new Date(input.signedAt) : new Date(),
          absent: Boolean(input.absent),
          absentReason: input.absentReason ?? null,
          ...(blobId ? { blobId } : input.absent ? { blobId: null } : {}),
        },
      });
      return Response.json({ signature: row }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
