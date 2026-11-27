import { requireActingContext, requirePermission, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse, forbidden, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  closeOpenGlobalClassification,
  globalClassificationKey,
} from "@/services/registration/classificationScope";

/**
 * GET/PATCH /api/platform/classifications/:modelId
 * Global classification template — platform_operator capacity only (E104 / A97).
 */

function assertPlatformOperator(ctx: Awaited<ReturnType<typeof requireActingContext>>) {
  const capacity = (ctx.user as { organisationCapacity?: string | null }).organisationCapacity;
  const role = ctx.user.role;
  if (capacity !== "platform_operator" && role !== "superadmin") {
    throw forbidden("Global classification edits require platform_operator");
  }
}

export async function GET(req: Request, ctxParams: { params: Promise<{ modelId: string }> }) {
  let correlationId: string | undefined;
  try {
    const { modelId } = await ctxParams.params;
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "catalog:view");
      const row = await prisma.deviceModelClassification.findFirst({
        where: {
          deviceModelId: modelId,
          tenantId: null,
          validTo: null,
        },
        orderBy: { validFrom: "desc" },
      });
      return Response.json(
        { classification: row, scope: "global" },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}

export async function PATCH(req: Request, ctxParams: { params: Promise<{ modelId: string }> }) {
  let correlationId: string | undefined;
  try {
    const { modelId } = await ctxParams.params;
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;
      requirePermission(ctx, "catalog:update");
      assertPlatformOperator(ctx);

      const body = (await req.json()) as {
        stk?: boolean;
        radiation?: boolean;
        softwareClass?: string | null;
        evidenceText?: string | null;
        confidence?: "verified" | "responsible" | "derived";
      };

      const model = await prisma.deviceModel.findFirst({ where: { id: modelId } });
      if (!model) throw notFound("Model");

      const ruleSet =
        (await prisma.refRuleSet.findFirst({ where: { code: "MPBETREIBV", validTo: null } })) ??
        (await prisma.refRuleSet.findFirst());
      if (!ruleSet) throw unprocessable("Rule sets not loaded");

      const row = await prisma.$transaction(async (tx) => {
        const prev = await tx.deviceModelClassification.findFirst({
          where: { deviceModelId: modelId, tenantId: null, validTo: null },
          orderBy: { validFrom: "desc" },
        });
        await closeOpenGlobalClassification(tx, { deviceModelId: modelId });
        return tx.deviceModelClassification.create({
          data: {
            deviceModelId: modelId,
            tenantId: null,
            openClassificationKey: globalClassificationKey(modelId),
            stk: body.stk ?? prev?.stk ?? false,
            radiation: body.radiation ?? prev?.radiation ?? false,
            softwareClass:
              body.softwareClass !== undefined ? body.softwareClass : (prev?.softwareClass ?? null),
            confidence: body.confidence ?? prev?.confidence ?? "derived",
            evidenceText:
              body.evidenceText !== undefined ? body.evidenceText : (prev?.evidenceText ?? null),
            ruleSetId: ruleSet.id,
            confirmedBy: ctx.user.name,
            confirmedAt: new Date(),
          },
        });
      });

      return Response.json(
        { classification: row, scope: "global" },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
