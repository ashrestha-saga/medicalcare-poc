import type { TenantWorkContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { blobMetaFromDataUrl } from "@/lib/blobMeta";
import { notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { EvidenceKind } from "./types";

export interface UpsertEvidenceInput {
  prerequisiteCode: string;
  evidenceKind: EvidenceKind;
  /** data URL for document evidence */
  dataUrl?: string | null;
  externalRecordRef?: string | null;
  issuedBy?: string | null;
  issuedAt?: string | null;
  validUntil?: string | null;
}

export const evidenceService = {
  async list(ctx: TenantWorkContext, deviceInstanceId: string) {
    requirePermission(ctx, "inventory:view");
    const rows = await prisma.deviceEvidence.findMany({
      where: { tenantId: ctx.tenantId, deviceInstanceId },
      orderBy: { recordedAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      prerequisiteCode: r.prerequisiteCode,
      evidenceKind: r.evidenceKind,
      attachmentBlobId: r.attachmentBlobId,
      externalRecordRef: r.externalRecordRef,
      issuedBy: r.issuedBy,
      issuedAt: r.issuedAt?.toISOString() ?? null,
      validUntil: r.validUntil?.toISOString() ?? null,
      recordedBy: r.recordedBy,
      recordedAt: r.recordedAt.toISOString(),
    }));
  },

  async upsert(ctx: TenantWorkContext, deviceInstanceId: string, input: UpsertEvidenceInput) {
    requirePermission(ctx, "inventory:update");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceInstanceId, tenantId: ctx.tenantId },
    });
    if (!device) throw notFound("Device / draft not found.");
    if (device.state === "retired") throw unprocessable("Retired record.");

    const code = input.prerequisiteCode.trim();
    if (!code) throw unprocessable("prerequisiteCode is required.", { field: "prerequisiteCode" });

    if (input.evidenceKind === "document" && !input.dataUrl?.trim() && !input.externalRecordRef?.trim()) {
      throw unprocessable("Document evidence requires a file upload or external reference.", {
        field: "dataUrl",
      });
    }
    if (input.evidenceKind === "third_party" && !input.externalRecordRef?.trim() && !input.dataUrl?.trim()) {
      throw unprocessable(
        "Third-party evidence requires an external record reference (Prüfpartner / authority).",
        { field: "externalRecordRef" },
      );
    }

    let attachmentBlobId: string | null = null;
    if (input.dataUrl?.trim()) {
      const dataUrl = input.dataUrl.trim();
      const meta = blobMetaFromDataUrl(dataUrl);
      const blob = await prisma.attachmentBlob.create({
        data: {
          tenantId: ctx.tenantId,
          kind: `evidence:${code}`,
          dataUrl,
          contentType: meta.contentType,
          byteSize: meta.byteSize,
        },
      });
      attachmentBlobId = blob.id;
    }

    const existing = await prisma.deviceEvidence.findUnique({
      where: {
        deviceInstanceId_prerequisiteCode: { deviceInstanceId, prerequisiteCode: code },
      },
    });

    const data = {
      evidenceKind: input.evidenceKind,
      attachmentBlobId: attachmentBlobId ?? existing?.attachmentBlobId ?? null,
      externalRecordRef: input.externalRecordRef?.trim() || existing?.externalRecordRef || null,
      issuedBy: input.issuedBy?.trim() || null,
      issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      recordedBy: ctx.user.name,
      recordedAt: new Date(),
    };

    const row = existing
      ? await prisma.deviceEvidence.update({ where: { id: existing.id }, data })
      : await prisma.deviceEvidence.create({
          data: {
            tenantId: ctx.tenantId,
            deviceInstanceId,
            prerequisiteCode: code,
            ...data,
          },
        });

    return {
      id: row.id,
      prerequisiteCode: row.prerequisiteCode,
      evidenceKind: row.evidenceKind,
      attachmentBlobId: row.attachmentBlobId,
      externalRecordRef: row.externalRecordRef,
    };
  },
};
