import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Local filesystem dual-read store (Phase 6). Swap for S3 later behind the same API. */
export function blobStorageRoot(): string {
  return process.env.BLOB_STORAGE_DIR?.trim() || path.join(process.cwd(), ".data", "blobs");
}

export function buildStorageKey(tenantId: string, kind: string): string {
  const safeKind = kind.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 64);
  return `${tenantId}/${safeKind}/${randomUUID()}`;
}

export async function writeBlobBytes(
  storageKey: string,
  bytes: Buffer,
): Promise<{ byteSize: number; sha256: string }> {
  const full = path.join(blobStorageRoot(), storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return {
    byteSize: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function readBlobBytes(storageKey: string): Promise<Buffer> {
  const full = path.join(blobStorageRoot(), storageKey);
  return readFile(full);
}

/** Parse a data URL into bytes + content type. */
export function bytesFromDataUrl(dataUrl: string): {
  bytes: Buffer;
  contentType: string | null;
} {
  const match = /^data:([^;,]+)?(?:;[^,]*)?,([\s\S]*)$/i.exec(dataUrl);
  if (!match) {
    return { bytes: Buffer.from(dataUrl, "utf8"), contentType: null };
  }
  const contentType = match[1]?.trim() || null;
  const payload = (match[2] ?? "").replace(/\s/g, "");
  const header = dataUrl.slice(0, dataUrl.indexOf(",") + 1);
  const isBase64 = /;base64/i.test(header);
  const bytes = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  return { bytes, contentType };
}
