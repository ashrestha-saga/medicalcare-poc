import { requirePermission, requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/catalog/models/:id/classify-quick
 * Body: { annex: 'anlage1' | 'anlage2' | 'none', confirmed?: boolean }
 */
export async function POST(req: Request, ctxParams: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;
  try {
    const { id } = await ctxParams.params;
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "inventory:update");
      const body = (await req.json()) as {
        annex?: "anlage1" | "anlage2" | "none";
        confirmed?: boolean;
      };
      if (!body.annex) throw unprocessable("annex required");

      const model = await prisma.deviceModel.findFirst({ where: { id } });
      if (!model) throw notFound("Model");

      const ruleSetId = "rs-mpbetreibv";
      await prisma.deviceModelClassification.updateMany({
        where: { deviceModelId: id, validTo: null },
        data: { validTo: new Date(), openClassificationKey: null },
      });

      const stk = body.annex === "anlage1";
      const row = await prisma.deviceModelClassification.create({
        data: {
          deviceModelId: id,
          stk,
          radiation: false,
          confidence: "responsible",
          ruleSetId,
          confirmedBy: body.confirmed === false ? null : ctx.user.name,
          confirmedAt: body.confirmed === false ? null : new Date(),
          openClassificationKey: id,
          evidenceText:
            body.annex === "none"
              ? "Keine Einstufung Anlage 1/2 (Import-Schnellklassifikation)"
              : `Import-Schnellklassifikation ${body.annex}`,
        },
      });

      await prisma.deviceModel.update({
        where: { id },
        data: { state: "released" },
      });

      return Response.json(
        { classification: row },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
