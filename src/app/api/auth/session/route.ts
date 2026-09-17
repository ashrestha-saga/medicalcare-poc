import { readSession } from "@/lib/auth/session";
import { tenantOxidService } from "@/services/oxid/tenantOxidService";

/** Client-facing session user — omits internal Prisma tenantId. */
function toPublicUser(user: NonNullable<Awaited<ReturnType<typeof readSession>>>) {
  const { tenantId: _tenantId, ...publicUser } = user;
  return publicUser;
}

/** GET /api/auth/session — who am I (from the httpOnly cookie). */
export async function GET() {
  const user = await readSession();
  if (!user) return Response.json({ user: null }, { status: 200 });
  const oxid = await tenantOxidService.getPublicStatus(user.tenantId);
  return Response.json({
    user: toPublicUser(user),
    tenantName: user.companyName ?? null,
    oxidStatus: oxid.status,
  });
}
