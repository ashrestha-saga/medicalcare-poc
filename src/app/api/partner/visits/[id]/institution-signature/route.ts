import { z } from "zod";
import {
  requirePartnerContext,
  requirePartnerPermission,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { errorResponse, notFound } from "@/lib/errors";
import { isRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";
import { assertPartnerManagesTenant } from "@/services/access/partnerAccessService";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  signerName: z.string().trim().min(1).max(200),
  signerRole: z.string().trim().max(200).optional().nullable(),
  signatureBlobId: z.string().trim().optional().nullable(),
});

/** POST /api/partner/visits/:id/institution-signature — RD26 visit-level countersignature. */
export async function POST(req: Request, ctxParams: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "visits:manage", "inspections:perform");
      correlationId = ctx.correlationId;
      const { id } = await ctxParams.params;
      const input = schema.parse(await req.json());

      const visit = await prisma.serviceVisit.findFirst({
        where: { id, organisationId: ctx.organisationId },
      });
      if (!visit) throw notFound("Visit not found");

      await assertPartnerManagesTenant(ctx.user.id, ctx.organisationId, visit.tenantId);

      const tenant = await prisma.tenant.findUnique({
        where: { id: visit.tenantId },
        select: { featureFlags: true },
      });
      if (!isRadiationDguvEnabled(tenant?.featureFlags)) {
        return Response.json(
          { error: { code: "feature_disabled", message: "radiation_dguv not enabled" } },
          { status: 404, headers: { "x-correlation-id": ctx.correlationId } },
        );
      }

      const updated = await prisma.serviceVisit.update({
        where: { id },
        data: {
          institutionSignerName: input.signerName,
          institutionSignerRole: input.signerRole?.trim() || null,
          institutionSignatureBlobId: input.signatureBlobId?.trim() || null,
          institutionSignedAt: new Date(),
        },
      });

      return Response.json(
        {
          visit: {
            id: updated.id,
            institutionSignerName: updated.institutionSignerName,
            institutionSignedAt: updated.institutionSignedAt?.toISOString() ?? null,
          },
        },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
