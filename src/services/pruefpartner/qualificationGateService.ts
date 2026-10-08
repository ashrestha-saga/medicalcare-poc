import { prisma } from "@/lib/prisma";

export interface QualificationGateResult {
  ok: boolean;
  required: { code: string; label: string }[];
  missing: { code: string; label: string }[];
}

/** Check performer qualifications against catalogue at performance date. */
export async function checkQualificationGate(args: {
  userId: string;
  catalogueId: string;
  inspectionTypeCode: string;
  performanceDate: Date;
}): Promise<QualificationGateResult> {
  const catalogueQuals = await prisma.refCatalogueQualification.findMany({
    where: { catalogueId: args.catalogueId },
    include: { qualification: { select: { code: true, label: true } } },
  });

  const typeQuals =
    catalogueQuals.length > 0
      ? catalogueQuals
      : await prisma.refQualificationRule.findMany({
          where: { inspectionTypeCode: args.inspectionTypeCode },
          include: { qualification: { select: { code: true, label: true } } },
        });

  const required = typeQuals.map((q) => ({
    code: q.qualification.code,
    label: q.qualification.label,
  }));

  if (required.length === 0) {
    return { ok: true, required: [], missing: [] };
  }

  const holds = await prisma.personQualification.findMany({
    where: { userId: args.userId, qualificationCode: { in: required.map((r) => r.code) } },
  });

  const perfDay = args.performanceDate;
  const missing: { code: string; label: string }[] = [];

  for (const req of required) {
    const hold = holds.find((h) => h.qualificationCode === req.code);
    if (!hold) {
      missing.push(req);
      continue;
    }
    if (hold.validUntil && hold.validUntil < perfDay) {
      missing.push(req);
    }
  }

  return { ok: missing.length === 0, required, missing };
}
