import type { Attachment as MailAttachment } from "nodemailer";
import { prisma } from "@/lib/prisma";

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;
const ATTACHMENT_PATH_RE = /^\/api\/attachments\/([a-z0-9_-]+)$/i;

function extForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

function fromDataUrl(dataUrl: string, kind: string, index: number): MailAttachment | null {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const content = Buffer.from(match[2], "base64");
  return {
    filename: `${kind}-${index + 1}.${extForMime(contentType)}`,
    content,
    contentType,
  };
}

/**
 * Loads service-request photos for SMTP. Resolves `/api/attachments/:id` to
 * AttachmentBlob data URLs. Never returns credentials; safe to count in logs.
 */
export async function loadMailAttachments(
  serviceRequestId: string,
  tenantId: string,
): Promise<MailAttachment[]> {
  const rows = await prisma.attachment.findMany({
    where: { serviceRequestId },
    orderBy: { createdAt: "asc" },
  });

  const out: MailAttachment[] = [];
  let index = 0;
  for (const row of rows) {
    const pathMatch = ATTACHMENT_PATH_RE.exec(row.url.trim());
    if (pathMatch) {
      const blob = await prisma.attachmentBlob.findFirst({
        where: { id: pathMatch[1], tenantId },
        select: { dataUrl: true },
      });
      if (!blob) continue;
      const att = fromDataUrl(blob.dataUrl, row.kind, index);
      if (att) {
        out.push(att);
        index++;
      }
      continue;
    }
    if (row.url.startsWith("data:")) {
      const att = fromDataUrl(row.url, row.kind, index);
      if (att) {
        out.push(att);
        index++;
      }
    }
  }
  return out;
}
