import { readSession } from "@/lib/auth/session";
import { isClinicSession, isPartnerSession } from "@/interfaces/session";

/** Client-facing session user — omits clinic tenantId; partners keep organisationId for shell routing. */
function toPublicUser(user: NonNullable<Awaited<ReturnType<typeof readSession>>>) {
  if (isPartnerSession(user)) return user;
  const { tenantId: _tenantId, ...publicUser } = user;
  return publicUser;
}

/**
 * GET /api/auth/session — who am I (from the httpOnly cookie).
 * OXID is optional and loaded from Settings (`/api/settings/oxid`), not here —
 * avoids SEC-01 on TenantOxidConnection during every session hydrate.
 */
export async function GET() {
  const user = await readSession();
  if (!user) return Response.json({ user: null }, { status: 200 });

  if (isPartnerSession(user)) {
    return Response.json({
      user: toPublicUser(user),
      tenantName: user.organisationName,
      oxidStatus: "disconnected",
      homePath: "/partner",
    });
  }

  if (!isClinicSession(user)) {
    return Response.json({ user: null }, { status: 200 });
  }

  return Response.json({
    user: toPublicUser(user),
    tenantName: user.companyName ?? null,
    oxidStatus: "disconnected",
    homePath: "/",
  });
}
