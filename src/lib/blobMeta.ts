/** Parse data-URL prefix for AttachmentBlob metadata (SCH-10). */
export function blobMetaFromDataUrl(dataUrl: string): {
  contentType: string | null;
  byteSize: number | null;
} {
  const match = /^data:([^;,]+)?(?:;[^,]*)?,([\s\S]*)$/i.exec(dataUrl);
  if (!match) return { contentType: null, byteSize: null };
  const contentType = match[1]?.trim() || null;
  const payload = match[2] ?? "";
  const isBase64 = /;base64/i.test(dataUrl.slice(0, dataUrl.indexOf(",") + 1));
  if (isBase64) {
    const cleaned = payload.replace(/\s/g, "");
    const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
    return {
      contentType,
      byteSize: Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding),
    };
  }
  try {
    return { contentType, byteSize: decodeURIComponent(payload).length };
  } catch {
    return { contentType, byteSize: payload.length };
  }
}
