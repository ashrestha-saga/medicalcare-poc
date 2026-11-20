import { z } from "zod";
import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createAttachmentFromDataUrl } from "@/services/storage/attachmentBlobService";
import { svExternalService } from "@/services/radiation/svExternalService";

type Ctx = { params: Promise<{ reference: string }> };

const schema = z
  .object({
    externalCertificateRef: z.string().trim().min(1),
    externalCertificateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    externalCertificateBlobId: z.string().trim().min(1).optional(),
    /** PDF/image as data URL — stored as AttachmentBlob when blob id not provided. */
    dataUrl: z.string().trim().min(1).optional(),
    externalResult: z.enum(["passed", "objected"]),
    externalDefectsText: z.string().trim().max(4000).optional().nullable(),
    externalOrgName: z.string().trim().max(300).optional().nullable(),
  })
  .refine((v) => Boolean(v.externalCertificateBlobId?.trim() || v.dataUrl?.trim()), {
    message: "Certificate attachment required",
    path: ["externalCertificateBlobId"],
  });

/** POST /api/requests/:reference/external-certificate — R40 SV certificate intake. */
export async function POST(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { reference } = await ctxParams.params;
      const input = schema.parse(await req.json());

      let blobId = input.externalCertificateBlobId?.trim() || "";
      if (!blobId && input.dataUrl?.trim()) {
        if (!input.dataUrl.startsWith("data:")) {
          throw unprocessable("dataUrl must be a data URL", { field: "dataUrl" });
        }
        const blob = await createAttachmentFromDataUrl(prisma, {
          tenantId: ctx.tenantId,
          kind: "sv_certificate",
          dataUrl: input.dataUrl.trim(),
        });
        blobId = blob.id;
      }

      const result = await svExternalService.intakeCertificate(ctx, reference, {
        externalCertificateRef: input.externalCertificateRef,
        externalCertificateDate: input.externalCertificateDate,
        externalCertificateBlobId: blobId,
        externalResult: input.externalResult,
        externalDefectsText: input.externalDefectsText,
        externalOrgName: input.externalOrgName,
      });
      return Response.json({ result }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
