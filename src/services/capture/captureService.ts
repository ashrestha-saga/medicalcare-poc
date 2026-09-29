import type { CapturedArticleDTO, TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { blobMetaFromDataUrl } from "@/lib/blobMeta";
import { recordAudit } from "@/services/audit/auditService";
import type { CaptureRequestInput } from "@/schemas/resolve";
import { unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { toCapturedArticleDTO } from "@/services/shared/mappers";

/**
 * Stage 4 — FA-100 / DAT-302a — manual capture.
 * Name and nameplate photo are mandatory. `serviceOnly` is hard-coded here;
 * the client cannot influence it (Section 20).
 */
export const captureService = {
  async create(
    input: CaptureRequestInput,
    tenantId: string,
    capturedBy: string,
    ctx?: TenantWorkContext,
  ): Promise<CapturedArticleDTO> {
    if (!input.name?.trim()) throw unprocessable("Please enter the device name.");
    if (!input.nameplatePhoto) throw unprocessable("Please add the nameplate photo.");

    // The nameplate photo is stored as an Attachment-like blob reference. Without
    // object storage in this environment we keep the (downscaled) data URL inline.
    const meta = blobMetaFromDataUrl(input.nameplatePhoto);
    const nameplate = await prisma.attachmentBlob.create({
      data: {
        tenantId,
        kind: "nameplate",
        dataUrl: input.nameplatePhoto,
        contentType: meta.contentType,
        byteSize: meta.byteSize,
      },
    });

    const row = await prisma.capturedArticle.create({
      data: {
        tenantId,
        name: input.name.trim(),
        manufacturer: input.manufacturer?.trim() || null,
        number: input.number?.trim() || null,
        numberType: input.number?.trim() ? input.numberType : "none",
        rawIdentifier: input.rawIdentifier ?? null,
        nameplateAttachmentId: nameplate.id,
        capturedBy,
        serviceOnly: true, // DAT-302a — never derived from the request body
      },
    });
    const dto = toCapturedArticleDTO(row);
    if (ctx) {
      await recordAudit({
        actor: actorFromContext(ctx),
        resource: "capture",
        resourceId: row.id,
        action: "create",
        summary: `Captured unknown article ${row.name}`,
        after: { name: row.name, number: row.number, numberType: row.numberType },
      });
    }
    return dto;
  },

  async findById(id: string, tenantId: string): Promise<CapturedArticleDTO | null> {
    const row = await prisma.capturedArticle.findFirst({ where: { id, tenantId } });
    return row ? toCapturedArticleDTO(row) : null;
  },
};
