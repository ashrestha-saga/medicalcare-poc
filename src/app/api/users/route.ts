import { requireTenantContext } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { createUserSchema } from "@/schemas/user";
import { userAdminService } from "@/services/users/userAdminService";

/** GET /api/users?q= — list tenant users (users:view). */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const q = new URL(req.url).searchParams.get("q") ?? undefined;
    const users = await userAdminService.list(ctx, q);
    return Response.json({ users }, { headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

/** POST /api/users — create user (users:create). */
export async function POST(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    correlationId = ctx.correlationId;
    const input = createUserSchema.parse(await req.json());
    const user = await userAdminService.create(ctx, input);
    return Response.json({ user }, { status: 201, headers: { "x-correlation-id": ctx.correlationId } });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
