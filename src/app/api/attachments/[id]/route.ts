import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/** GET /api/attachments/:id — serves a stored (downscaled) photo, tenant-scoped. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const { id } = await params;
    const blob = await prisma.attachmentBlob.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!blob) throw notFound();
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(blob.dataUrl);
    if (!match) throw notFound();
    return new Response(Buffer.from(match[2], "base64"), {
      headers: { "content-type": match[1], "cache-control": "private, max-age=3600" },
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
