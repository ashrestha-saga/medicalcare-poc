import {
  requirePartnerContext,
  requirePartnerPermission,
  withTenantBypass,
} from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  surface: z.enum(["console", "inspect"]),
  navKey: z.string().trim().min(1).max(80),
});

/** POST /api/partner/nav-usage — D7 increment. */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requirePartnerContext(req);
    return await withTenantBypass(async () => {
      requirePartnerPermission(ctx, "console:nav");
      correlationId = ctx.correlationId;
      const input = schema.parse(await req.json().catch(() => ({})));
      const existing = await prisma.navUsage.findUnique({
        where: {
          userId_surface_navKey: {
            userId: ctx.user.id,
            surface: input.surface,
            navKey: input.navKey,
          },
        },
      });
      const row = existing
        ? await prisma.navUsage.update({
            where: { id: existing.id },
            data: { lastUsedAt: new Date(), useCount: existing.useCount + 1 },
          })
        : await prisma.navUsage.create({
            data: {
              userId: ctx.user.id,
              organisationId: ctx.organisationId,
              surface: input.surface,
              navKey: input.navKey,
            },
          });
      return Response.json({ usage: row }, { headers: { "x-correlation-id": ctx.correlationId } });
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
