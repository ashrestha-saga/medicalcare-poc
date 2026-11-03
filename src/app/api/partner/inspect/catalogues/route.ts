import {
  withTenantBypass,
  requirePartnerContext,
  requirePartnerPermission,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { prismaSystem } from "@/lib/prisma";

/** GET /api/partner/inspect/catalogues — catalogue list for Prüfpartner Kataloge view. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "catalogues:view", "inspections:view", "console:nav");
      correlationId = ctx.correlationId;
      const rows = await prismaSystem.refInspectionCatalogue.findMany({
        select: {
          id: true,
          code: true,
          label: true,
          draft: true,
          noCatalogue: true,
          inspectionTypeCode: true,
          draftReasons: true,
        },
        orderBy: [{ draft: "desc" }, { label: "asc" }],
        take: 100,
      });
      return Response.json(
        {
          catalogues: rows.map((r) => ({
            id: r.id,
            code: r.code,
            label: r.label,
            draft: r.draft,
            noCatalogue: r.noCatalogue,
            inspectionTypeCode: r.inspectionTypeCode,
            draftReasons: r.draftReasons,
          })),
        },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
