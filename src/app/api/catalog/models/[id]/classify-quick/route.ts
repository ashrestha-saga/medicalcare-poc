import { requirePermission, requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createTenantClassification } from "@/services/registration/classificationScope";

/**
 * POST /api/catalog/models/:id/classify-quick
 * Body: { annex: 'anlage1' | 'anlage2' | 'none', confirmed?: boolean }
 * E104 — writes the acting tenant row only (never closes global template).
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
      const stk = body.annex === "anlage1";
      const row = await prisma.$transaction(async (tx) => {
        const classification = await createTenantClassification(tx, {
          deviceModelId: id,
          tenantId: ctx.tenantId,
          ruleSetId,
          stk,
          radiation: false,
          confidence: "responsible",
          confirmedBy: body.confirmed === false ? null : ctx.user.name,
          confirmedAt: body.confirmed === false ? null : new Date(),
          evidenceText:
            body.annex === "none"
              ? "Keine Einstufung Anlage 1/2 (Import-Schnellklassifikation)"
              : `Import-Schnellklassifikation ${body.annex}`,
        });
        await tx.deviceModel.update({
          where: { id },
          data: { state: "released" },
        });

        // Import opens per-unit "Modell ohne Einstufung" clars — clear them so Erstanlage is not blocked.
        const instances = await tx.deviceInstance.findMany({
          where: { tenantId: ctx.tenantId, modelId: id },
          select: { id: true },
        });
        if (instances.length) {
          await tx.deviceClarification.updateMany({
            where: {
              tenantId: ctx.tenantId,
              deviceInstanceId: { in: instances.map((i) => i.id) },
              resolvedAt: null,
              kind: "classification",
            },
            data: {
              resolvedBy: ctx.user.name,
              resolvedAt: new Date(),
              resolutionNote: "Resolved by import quick-classify",
            },
          });
        }

        return classification;
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
