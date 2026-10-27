import { requireTenantContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { authorityPreparationService } from "@/services/authority/authorityPreparationService";

/** GET /api/authority/preparation?list=&filter= — work list per checklist item. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireTenantContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      const url = new URL(req.url);
      const list = url.searchParams.get("list");
      if (!list) {
        return Response.json(
          { error: { code: "bad_request", message: "list is required" } },
          { status: 400 },
        );
      }
      const filter = url.searchParams.get("filter"); // bereit|luecke|aussen|all
      const prep = await authorityPreparationService.preparation(ctx, list);
      const items =
        filter === "bereit"
          ? prep.items.filter((i) => i.state === "ready")
          : filter === "luecke"
            ? prep.items.filter((i) => i.state === "gap")
            : filter === "aussen"
              ? prep.items.filter((i) => i.state === "external")
              : prep.items;
      return Response.json(
        { ...prep, items },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
