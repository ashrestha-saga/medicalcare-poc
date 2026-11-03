import { requireActingContext, withTenantStore, requirePermission } from "@/lib/auth/tenantContext";
import { errorResponse, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  text: z.string().trim().min(1).max(4000),
  stepLabel: z.string().trim().max(200).optional(),
});

/**
 * POST /api/partner/inspection-runs/[id]/partner-hint
 * P3 / E12 — DeviceClarification kind=partner_hint (MPSB decides; not an incident).
 */
export async function POST(req: Request, { params }: Ctx) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      requirePermission(ctx, "inspections:perform");
      correlationId = ctx.correlationId;
      const { id } = await params;
      const input = schema.parse(await req.json().catch(() => ({})));
      if (ctx.user.accountKind !== "partner" || !ctx.user.organisationId) {
        throw unprocessable("Partner organisation required.");
      }

      const run = await prisma.inspectionRun.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: {
          id: true,
          deviceInstanceId: true,
          dutyPerformanceId: true,
        },
      });
      if (!run) throw notFound("Inspection run not found.");

      const label = input.stepLabel
        ? `Partner hint · ${input.stepLabel}`
        : "Partner hint · possible patient relevance";

      const row = await prisma.deviceClarification.create({
        data: {
          tenantId: ctx.tenantId,
          deviceInstanceId: run.deviceInstanceId,
          kind: "partner_hint",
          field: "patient_relevance",
          label,
          deferredBy: ctx.user.name,
          deferredAt: new Date(),
          resolutionNote: input.text,
          raisedByOrganisationId: ctx.user.organisationId,
          inspectionRunId: run.id,
        },
      });

      return Response.json(
        { id: row.id, kind: row.kind },
        { status: 201, headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
