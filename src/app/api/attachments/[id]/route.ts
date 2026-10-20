import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/** GET /api/attachments/:id — serves a stored blob (image, PDF, …), tenant-scoped. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const { id } = await params;
      const blob = await prisma.attachmentBlob.findFirst({ where: { id, tenantId: ctx.tenantId } });
      if (!blob) throw notFound();

      const match = /^data:([^;,]+)?(?:;base64)?,([\s\S]*)$/i.exec(blob.dataUrl);
      if (!match) throw notFound();
      const contentType =
        blob.contentType?.trim() || match[1]?.trim() || "application/octet-stream";
      const isBase64 = /;base64/i.test(blob.dataUrl.slice(0, blob.dataUrl.indexOf(",") + 1));
      const payload = (match[2] ?? "").replace(/\s/g, "");
      const body = isBase64
        ? Buffer.from(payload, "base64")
        : Buffer.from(decodeURIComponent(payload), "utf8");

      return new Response(body, {
        headers: {
          "content-type": contentType,
          "cache-control": "private, max-age=3600",
          "content-disposition": contentType.includes("pdf")
            ? 'inline; filename="document.pdf"'
            : "inline",
        },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
