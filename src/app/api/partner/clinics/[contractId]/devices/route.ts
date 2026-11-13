import {
  requirePartnerContext,
  requirePartnerPermission,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { errorResponse, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertPartnerManagesTenant } from "@/services/access/partnerAccessService";
import { listPartnerClinicDevices } from "@/services/repairs/partnerCreateOrderService";

type Ctx = { params: Promise<{ contractId: string }> };

/**
 * GET /api/partner/clinics/[contractId]/devices?q=
 * Released devices for create-order device picker.
 */
export async function GET(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:disposition:view");
      correlationId = ctx.correlationId;
      const { contractId } = await params;
      const contract = await prisma.serviceContract.findFirst({
        where: { id: contractId, organisationId: ctx.organisationId },
        select: { tenantId: true },
      });
      if (!contract) throw notFound("Clinic not found");
      await assertPartnerManagesTenant(ctx.user.id, ctx.organisationId, contract.tenantId);
      const q = new URL(req.url).searchParams.get("q") ?? undefined;
      const devices = await listPartnerClinicDevices(ctx, contract.tenantId, q ?? undefined);
      return Response.json(
        { tenantId: contract.tenantId, devices },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
