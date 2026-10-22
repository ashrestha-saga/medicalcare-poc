import type { ModelDocumentDTO, TenantContext, TenantWorkContext } from "@/interfaces";
import { actorAttribution } from "@/lib/auth/attribution";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import { createAttachmentFromDataUrl } from "@/services/storage/attachmentBlobService";
import type { DocumentKind } from "@prisma/client";

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function mapDoc(row: {
  id: string;
  deviceModelId: string;
  kind: DocumentKind;
  revisionLabel: string;
  language: string;
  validFrom: Date;
  supersededAt: Date | null;
  blobId: string | null;
  externalUrl: string | null;
  recordedByName: string;
  recordedAt: Date;
}): ModelDocumentDTO {
  return {
    id: row.id,
    deviceModelId: row.deviceModelId,
    kind: row.kind,
    revisionLabel: row.revisionLabel,
    language: row.language,
    validFrom: isoDate(row.validFrom)!,
    supersededAt: isoDate(row.supersededAt),
    blobId: row.blobId,
    externalUrl: row.externalUrl,
    recordedByName: row.recordedByName,
    recordedAt: row.recordedAt.toISOString(),
    openUrl: row.blobId
      ? `/api/attachments/${row.blobId}`
      : row.externalUrl,
  };
}

export const modelDocumentService = {
  async listCurrent(
    ctx: TenantWorkContext,
    deviceModelId: string,
    kind: DocumentKind = "ifu",
  ): Promise<ModelDocumentDTO | null> {
    requirePermission(ctx, "catalog:view");
    const row = await prisma.modelDocument.findFirst({
      where: { deviceModelId, kind, supersededAt: null },
      orderBy: { validFrom: "desc" },
    });
    return row ? mapDoc(row) : null;
  },

  async listForModel(
    ctx: TenantWorkContext,
    deviceModelId: string,
  ): Promise<ModelDocumentDTO[]> {
    requirePermission(ctx, "catalog:view");
    const rows = await prisma.modelDocument.findMany({
      where: { deviceModelId },
      orderBy: [{ kind: "asc" }, { validFrom: "desc" }],
      take: 100,
    });
    return rows.map(mapDoc);
  },

  /**
   * Publish a new model IFU (or other kind). Supersedes the previous current of same kind+language.
   */
  async publish(
    ctx: TenantContext,
    input: {
      deviceModelId: string;
      kind?: DocumentKind;
      revisionLabel: string;
      language?: string;
      validFrom?: string;
      dataUrl?: string | null;
      externalUrl?: string | null;
      fieldSafetyActionId?: string | null;
    },
  ): Promise<ModelDocumentDTO> {
    requirePermission(ctx, "catalog:update");
    const model = await prisma.deviceModel.findFirst({ where: { id: input.deviceModelId } });
    if (!model) throw notFound("Model not found");

    const kind = input.kind ?? "ifu";
    const language = (input.language ?? "de").trim() || "de";
    const revisionLabel = input.revisionLabel.trim();
    if (!revisionLabel) throw badRequest("revisionLabel is required");
    if (!input.dataUrl?.trim() && !input.externalUrl?.trim()) {
      throw badRequest("Provide a file (dataUrl) or externalUrl");
    }

    const actor = actorAttribution(ctx);
    const validFrom = input.validFrom
      ? new Date(`${input.validFrom}T00:00:00.000Z`)
      : new Date();

    const row = await prisma.$transaction(async (tx) => {
      let blobId: string | null = null;
      if (input.dataUrl?.trim()) {
        const blob = await createAttachmentFromDataUrl(tx, {
          tenantId: ctx.tenantId,
          kind: `model:${kind}`,
          dataUrl: input.dataUrl.trim(),
        });
        blobId = blob.id;
      }

      const previous = await tx.modelDocument.findMany({
        where: {
          deviceModelId: input.deviceModelId,
          kind,
          language,
          supersededAt: null,
        },
      });

      const created = await tx.modelDocument.create({
        data: {
          tenantId: ctx.tenantId,
          deviceModelId: input.deviceModelId,
          kind,
          revisionLabel,
          language,
          validFrom,
          blobId,
          externalUrl: input.externalUrl?.trim() || null,
          fieldSafetyActionId: input.fieldSafetyActionId ?? null,
          recordedByName: actor.name,
          recordedByUserId: actor.userId,
        },
      });

      for (const prev of previous) {
        await tx.modelDocument.update({
          where: { id: prev.id },
          data: {
            supersededAt: validFrom,
            supersededById: created.id,
          },
        });
      }

      return created;
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "ModelDocument",
      resourceId: row.id,
      action: "publish",
      summary: `Model ${kind} ${revisionLabel} (${language})`,
    });

    return mapDoc(row);
  },

  /** Prefer current model IFU; used by device book / scan. */
  async currentIfuForModel(
    ctx: TenantWorkContext,
    deviceModelId: string | null | undefined,
  ): Promise<ModelDocumentDTO | null> {
    if (!deviceModelId) return null;
    const row = await prisma.modelDocument.findFirst({
      where: { deviceModelId, kind: "ifu", supersededAt: null },
      orderBy: { validFrom: "desc" },
    });
    return row ? mapDoc(row) : null;
  },
};
