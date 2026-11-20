import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local filesystem dual-read store (Phase 6). Swap for S3 later behind the same API.
 * Default root is statically scoped under `.data/blobs` so Turbopack does not trace the whole project.
 * Optional BLOB_STORAGE_DIR overrides that root (marked ignore for the bundler).
 */
export function blobStorageRoot(): string {
  const override = process.env.BLOB_STORAGE_DIR?.trim();
  if (override) return override;
  return path.join(process.cwd(), ".data", "blobs");
}

export function buildStorageKey(tenantId: string, kind: string): string {
  const safeKind = kind.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 64);
  return `${tenantId}/${safeKind}/${randomUUID()}`;
}

export async function writeBlobBytes(
  storageKey: string,
  bytes: Buffer,
): Promise<{ byteSize: number; sha256: string }> {
  const override = process.env.BLOB_STORAGE_DIR?.trim();
  if (override) {
    const full = path.join(/* turbopackIgnore: true */ override, storageKey);
    await mkdir(/* turbopackIgnore: true */ path.dirname(full), { recursive: true });
    await writeFile(/* turbopackIgnore: true */ full, bytes);
  } else {
    const full = path.join(process.cwd(), ".data", "blobs", storageKey);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
  }
  return {
    byteSize: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function readBlobBytes(storageKey: string): Promise<Buffer> {
  const override = process.env.BLOB_STORAGE_DIR?.trim();
  if (override) {
    return readFile(
      /* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ override, storageKey),
    );
  }
  return readFile(path.join(process.cwd(), ".data", "blobs", storageKey));
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
