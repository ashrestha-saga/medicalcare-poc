import type { CapturedArticleDTO } from "@/interfaces";
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
  async create(input: CaptureRequestInput, tenantId: string, capturedBy: string): Promise<CapturedArticleDTO> {
    if (!input.name?.trim()) throw unprocessable("Please enter the device name.");
    if (!input.nameplatePhoto) throw unprocessable("Please add the nameplate photo.");

    // The nameplate photo is stored as an Attachment-like blob reference. Without
    // object storage in this environment we keep the (downscaled) data URL inline.
    const nameplate = await prisma.attachmentBlob.create({
      data: { tenantId, kind: "nameplate", dataUrl: input.nameplatePhoto },
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
    return toCapturedArticleDTO(row);
  },

  async findById(id: string, tenantId: string): Promise<CapturedArticleDTO | null> {
    const row = await prisma.capturedArticle.findFirst({ where: { id, tenantId } });
    return row ? toCapturedArticleDTO(row) : null;
  },
};
