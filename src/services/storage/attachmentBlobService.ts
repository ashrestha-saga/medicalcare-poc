import type { Prisma, PrismaClient } from "@prisma/client";
import {
  blobMetaFromDataUrl,
} from "@/lib/blobMeta";
import {
  bytesFromDataUrl,
  buildStorageKey,
  readBlobBytes,
  writeBlobBytes,
} from "@/lib/storage/blobStore";

type Tx = Prisma.TransactionClient | PrismaClient;

/** Prefer object storage for payloads above this size (bytes of decoded body). */
const INLINE_MAX_BYTES = 48_000;

/**
 * Create AttachmentBlob: small payloads may stay as dataUrl; larger go to storageKey.
 * Dual-read: either field may be set.
 */
export async function createAttachmentFromDataUrl(
  tx: Tx,
  args: { tenantId: string; kind: string; dataUrl: string },
): Promise<{ id: string; storageKey: string | null; usedStorage: boolean }> {
  const dataUrl = args.dataUrl.trim();
  const meta = blobMetaFromDataUrl(dataUrl);
  const { bytes, contentType } = bytesFromDataUrl(dataUrl);
  const useStorage = bytes.length > INLINE_MAX_BYTES;

  if (useStorage) {
    const storageKey = buildStorageKey(args.tenantId, args.kind);
    const written = await writeBlobBytes(storageKey, bytes);
    const row = await tx.attachmentBlob.create({
      data: {
        tenantId: args.tenantId,
        kind: args.kind,
        dataUrl: null,
        storageKey,
        contentType: contentType ?? meta.contentType,
        byteSize: written.byteSize,
        sha256: written.sha256,
      },
    });
    return { id: row.id, storageKey, usedStorage: true };
  }

  const row = await tx.attachmentBlob.create({
    data: {
      tenantId: args.tenantId,
      kind: args.kind,
      dataUrl,
      storageKey: null,
      contentType: contentType ?? meta.contentType,
      byteSize: meta.byteSize ?? bytes.length,
    },
  });
  return { id: row.id, storageKey: null, usedStorage: false };
}

/** Build a PDF data URL from raw bytes (used by server-rendered reports). */
export function pdfDataUrl(bytes: Uint8Array): string {
  return `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`;
}

/** Read the bytes of an AttachmentBlob (storageKey or legacy dataUrl). Null when missing. */
export async function readAttachmentBytes(
  tx: Tx,
  blobId: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const blob = await tx.attachmentBlob.findFirst({ where: { id: blobId } });
  if (!blob) return null;
  if (blob.storageKey) {
    return {
      bytes: await readBlobBytes(blob.storageKey),
      contentType: blob.contentType?.trim() || "application/octet-stream",
    };
  }
  if (blob.dataUrl) {
    const { bytes, contentType } = bytesFromDataUrl(blob.dataUrl);
    return {
      bytes,
      contentType: blob.contentType?.trim() || contentType || "application/octet-stream",
    };
  }
  return null;
}
