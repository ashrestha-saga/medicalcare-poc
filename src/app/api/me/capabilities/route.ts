import { ACTING_TENANT_HEADER } from "@/constants/session";
import { errorResponse } from "@/lib/errors";
import { requirePartnerContext, requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { readSession } from "@/lib/auth/session";
import { resolveCapabilities, resolvePartnerCapabilities } from "@/services/auth/capabilitiesService";
import { assertPartnerManagesTenant } from "@/services/access/partnerAccessService";

/** GET /api/me/capabilities — clinic RoleGrant, or partner org-level / acting-tenant intersection. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const user = await readSession();
    if (user?.accountKind === "partner") {
      const partner = await requirePartnerContext(req);
      correlationId = partner.correlationId;
      const tenantId = req.headers.get(ACTING_TENANT_HEADER)?.trim() ?? "";
      if (!tenantId) {
        return Response.json(await resolvePartnerCapabilities(partner.user.appRole, null), {
          headers: { "x-correlation-id": partner.correlationId },
        });
      }
      const access = await assertPartnerManagesTenant(partner.user.id, partner.organisationId, tenantId);
      return Response.json(await resolvePartnerCapabilities(access.appRole, access.scope), {
        headers: { "x-correlation-id": partner.correlationId },
      });
    }

    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      return Response.json(await resolveCapabilities(ctx.user.role, ctx.user.id), {
        headers: { "x-correlation-id": ctx.correlationId },
      });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
