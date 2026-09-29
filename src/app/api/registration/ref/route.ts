import { requireActingContext, withTenantStore } from "@/lib/auth/tenantContext";
import { errorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  annex2MetaById,
  parseJsonStringArray,
  ZUBEHOER_TEMPLATES,
} from "@/services/registration/annex2Meta";

/** GET /api/registration/ref — bundled reference data for the wizard. */
export async function GET(req: Request) {
  let correlationId: string | undefined;
  try {
    const ctx = await requireActingContext(req);
    return await withTenantStore(ctx, async () => {
      correlationId = ctx.correlationId;

      const [annex2, constancy, reprocessing, equipment, radiation] = await Promise.all([
        prisma.refAnnex2Item.findMany({ orderBy: { itemNo: "asc" } }),
        prisma.refConstancyObject.findMany({ orderBy: { code: "asc" } }),
        prisma.refReprocessingClass.findMany({ orderBy: { code: "asc" } }),
        prisma.refReprocessingEquipmentType.findMany({ orderBy: { code: "asc" } }),
        prisma.refRadiationApplication.findMany({ orderBy: { code: "asc" } }),
      ]);

      return Response.json(
        {
          annex2: annex2.map((a) => {
            const meta = annex2MetaById(a.id);
            return {
              id: a.id,
              itemNo: a.itemNo,
              parentItemNo: a.parentItemNo,
              label: a.label,
              isGroup: a.isGroup,
              intervalYears: a.intervalYears,
              conditionText: a.conditionText,
              restriction: a.restriction,
              matchTerms: parseJsonStringArray(a.matchTerms),
              matchExclude: parseJsonStringArray(a.matchExclude),
              matchConfidence: a.matchConfidence,
              hinweis: meta?.hinweis ?? a.conditionText,
              verfahren: meta?.verfahren ?? null,
              wahlweiseNach: meta?.wahlweiseNach ?? null,
              variante: meta?.variante ?? null,
              quelle: meta?.quelle ?? null,
            };
          }),
          constancy: constancy.map((c) => ({
            code: c.code,
            label: c.label,
            defaultCadence: c.defaultCadence,
          })),
          reprocessing: reprocessing.map((r) => ({
            code: r.code,
            label: r.label,
            requiresQmsCert: r.requiresQmsCert,
            requiresValidatedProcess: r.requiresValidatedProcess,
            evidence: r.evidence,
            note: r.note,
          })),
          equipment: equipment.map((e) => ({
            code: e.code,
            label: e.label,
            equipmentStandard: e.equipmentStandard,
            validationStandard: e.validationStandard,
            revalidationMonths: e.revalidationMonths,
            intervalDisputed: e.intervalDisputed,
            intervalSource: e.intervalSource,
            routineChecks: parseJsonStringArray(e.routineChecks),
            releaseRule: e.releaseRule,
          })),
          radiation: radiation.map((r) => ({
            code: r.code,
            label: r.label,
            defaultAuthorisation: r.defaultAuthorisation,
            medicalBoardNote: r.medicalBoardNote,
            qualityGuideline: r.qualityGuideline,
            expertInspectionApplies: r.expertInspectionApplies,
          })),
          zubehoerTemplates: ZUBEHOER_TEMPLATES,
        },
        { headers: { "x-correlation-id": ctx.correlationId } },
      );
    });
  } catch (error) {
    return errorResponse(error, correlationId);
  }
}
