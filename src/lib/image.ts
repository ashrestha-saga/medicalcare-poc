/**
 * NFA-803 / Section 26 — client-side photo pipeline:
 *   validate type → resize longest edge ≤ 1600px → compress → data URL
 * Errors are reported, never swallowed: a photo is not silently dropped.
 */

export const MAX_EDGE_PX = 1600;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageProcessingError";
  }
}

export function targetDimensions(width: number, height: number, maxEdge = MAX_EDGE_PX): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function loadBitmap(file: Blob): Promise<{ draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { width: bmp.width, height: bmp.height, draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h), release: () => bmp.close() };
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ImageProcessingError("The photo could not be read. Please try again."));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h), release: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export async function downscaleImage(file: Blob, quality = 0.82): Promise<string> {
  if (file.type && !ACCEPTED.includes(file.type)) {
    throw new ImageProcessingError("Please choose a photo (JPEG, PNG, WebP or HEIC).");
  }
  const bitmap = await loadBitmap(file);
  try {
    const { width, height } = targetDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageProcessingError("Image processing is not available on this device.");
    bitmap.draw(ctx, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (!dataUrl.startsWith("data:image/jpeg")) throw new ImageProcessingError("The photo could not be compressed.");
    return dataUrl;
  } finally {
    bitmap.release();
  }
}
