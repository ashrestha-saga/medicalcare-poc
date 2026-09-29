import type {
  CreateTrainingEventResultDTO,
  TenantContext,
  TrainingEventDTO,
  TrainingEventStatusKind,
  TrainingFormOptionsDTO,
  TrainingInstructionStatus,
  TrainingMatrixCellDTO,
  TrainingOverviewDTO,
  TrainingPersonDTO,
  TrainingSummaryDTO,
  TrainingTypeOptionDTO,
} from "@/interfaces";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { recordAudit } from "@/services/audit/auditService";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { CreateTrainingEventInput } from "@/schemas/training";

/** Activity subjects for activity-based training types (mockup TAETIGKEITEN). */
export const TRAINING_ACTIVITY_OPTIONS = [
  "Arbeiten im Kontrollbereich",
  "Aufbereitung semikritisch",
  "Aufbereitung kritisch",
  "Bedienung Sterilisator",
] as const;

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function parseDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function monthsBetween(from: Date, to: Date): number {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  return years * 12 + months + (to.getDate() < from.getDate() ? -1 : 0);
}

/** Derives record.validUntil from held-on + type.validityMonths (null = no expiry). */
export function computeValidUntil(heldOn: Date, validityMonths: number | null): Date | null {
  if (validityMonths == null) return null;
  const d = new Date(heldOn.getTime());
  d.setUTCMonth(d.getUTCMonth() + validityMonths);
  return d;
}

export function deriveEventStatus(
  validityMonths: number | null,
  records: { validUntil: Date | null; confirmedAt: Date }[],
  now = new Date(),
): { statusKind: TrainingEventStatusKind; statusLabel: string } {
  if (validityMonths == null) {
    return { statusKind: "no_expiry", statusLabel: "No expiry" };
  }

  const overdue = records.filter((r) => r.validUntil && r.validUntil.getTime() < now.getTime());
  if (overdue.length > 0) {
    const oldest = overdue.reduce((a, b) =>
      (a.validUntil?.getTime() ?? 0) < (b.validUntil?.getTime() ?? 0) ? a : b,
    );
    const ago = oldest.validUntil ? Math.max(1, monthsBetween(oldest.validUntil, now)) : 1;
    return {
      statusKind: "overdue",
      statusLabel: `Overdue · ${ago} month${ago === 1 ? "" : "s"}`,
    };
  }

  const withUntil = records.filter((r) => r.validUntil);
  if (withUntil.length === 0) {
    return { statusKind: "valid", statusLabel: "Valid" };
  }
  const lastConfirm = records.reduce((a, b) =>
    a.confirmedAt.getTime() > b.confirmedAt.getTime() ? a : b,
  );
  const since = Math.max(0, monthsBetween(lastConfirm.confirmedAt, now));
  return {
    statusKind: "valid",
    statusLabel:
      since === 0 ? "Valid · this month" : `Valid · last ${since} month${since === 1 ? "" : "s"} ago`,
  };
}

function mapEvent(row: {
  id: string;
  trainingTypeCode: string;
  trainingType: {
    label: string;
    legalBasis: string;
    validityMonths: number | null;
    note: string | null;
  };
  subjectModelId: string | null;
  subjectModel: { tradeName: string | null; modelName: string | null } | null;
  subjectActivity: string | null;
  heldOn: Date;
  location: string | null;
  instructorName: string;
  instructorQualification: string;
  instructorExternal: boolean;
  basisDocument: string;
  mode: string;
  recordedBy: string;
  records: {
    id: string;
    personId: string;
    person: { name: string; jobTitle: string | null };
    confirmedAt: Date;
    validUntil: Date | null;
  }[];
}): TrainingEventDTO {
  const modelLabel = row.subjectModel?.tradeName || row.subjectModel?.modelName || null;
  const { statusKind, statusLabel } = deriveEventStatus(
    row.trainingType.validityMonths,
    row.records,
  );
  return {
    id: row.id,
    trainingTypeCode: row.trainingTypeCode,
    trainingTypeLabel: row.trainingType.label,
    legalBasis: row.trainingType.legalBasis,
    trainingTypeNote: row.trainingType.note,
    validityMonths: row.trainingType.validityMonths,
    subjectModelId: row.subjectModelId,
    subjectModelName: modelLabel,
    subjectActivity: row.subjectActivity,
    heldOn: isoDate(row.heldOn)!,
    location: row.location,
    instructorName: row.instructorName,
    instructorQualification: row.instructorQualification,
    instructorExternal: row.instructorExternal,
    basisDocument: row.basisDocument,
    mode: row.mode,
    recordedBy: row.recordedBy,
    recordCount: row.records.length,
    records: row.records.map((r) => ({
      id: r.id,
      personId: r.personId,
      personName: r.person.name,
      personJobTitle: r.person.jobTitle,
      confirmedAt: r.confirmedAt.toISOString(),
      validUntil: isoDate(r.validUntil),
    })),
    statusKind,
    statusLabel,
  };
}

/**
 * Person × model instruction matrix with product-series equivalence
 * (architecture §5.3). Reserved to the clinic tenant — partners never call this.
 */
export function computeInstructionMatrix(
  staff: { id: string; name: string; jobTitle?: string | null }[],
  models: { id: string; name: string; productSeries: string | null }[],
  instructed: { personId: string; modelId: string }[],
): TrainingMatrixCellDTO[] {
  const byPerson = new Map<string, Set<string>>();
  for (const row of instructed) {
    const set = byPerson.get(row.personId) ?? new Set();
    set.add(row.modelId);
    byPerson.set(row.personId, set);
  }

  const cells: TrainingMatrixCellDTO[] = [];
  for (const person of staff) {
    const done = byPerson.get(person.id) ?? new Set();
    for (const model of models) {
      let status: TrainingInstructionStatus = "open";
      if (done.has(model.id)) {
        status = "instructed";
      } else if (model.productSeries) {
        const equivalent = models.some(
          (other) =>
            other.id !== model.id &&
            other.productSeries === model.productSeries &&
            done.has(other.id),
        );
        if (equivalent) status = "equivalent_series";
      }
      cells.push({
        personId: person.id,
        personName: person.name,
        personJobTitle: person.jobTitle ?? null,
        modelId: model.id,
        modelName: model.name,
        productSeries: model.productSeries,
        status,
      });
    }
  }
  return cells;
}

function mapStaffRows(
  rows: {
    id: string;
    name: string;
    jobTitle: string | null;
    employedTo: Date | null;
    anonymisedAt: Date | null;
  }[],
): TrainingPersonDTO[] {
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    jobTitle: u.jobTitle,
    employedTo: isoDate(u.employedTo),
    anonymised: Boolean(u.anonymisedAt),
  }));
}

const eventInclude = {
  trainingType: {
    select: { label: true, legalBasis: true, validityMonths: true, note: true },
  },
  subjectModel: { select: { tradeName: true, modelName: true } },
  records: {
    include: { person: { select: { name: true, jobTitle: true } } },
    orderBy: { person: { name: "asc" as const } },
  },
};

export const trainingService = {
  async getOverview(ctx: TenantContext): Promise<TrainingOverviewDTO> {
    requirePermission(ctx, "training:view");

    const [events, staffRows, releasedModels, instructedRows, typeRows] = await Promise.all([
      prisma.trainingEvent.findMany({
        where: { tenantId: ctx.tenantId },
        include: eventInclude,
        orderBy: { heldOn: "desc" },
      }),
      prisma.user.findMany({
        where: {
          tenantId: ctx.tenantId,
          accountKind: "clinic",
          active: true,
          anonymisedAt: null,
        },
        select: {
          id: true,
          name: true,
          jobTitle: true,
          employedTo: true,
          anonymisedAt: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.deviceInstance.findMany({
        where: { tenantId: ctx.tenantId, state: "released", modelId: { not: null } },
        select: {
          modelId: true,
          model: { select: { id: true, tradeName: true, modelName: true, productSeries: true } },
        },
        distinct: ["modelId"],
      }),
      prisma.trainingRecord.findMany({
        where: {
          tenantId: ctx.tenantId,
          event: { subjectModelId: { not: null } },
        },
        select: {
          personId: true,
          event: { select: { subjectModelId: true } },
        },
      }),
      prisma.refTrainingType.findMany({
        orderBy: { code: "asc" },
        select: {
          code: true,
          label: true,
          legalBasis: true,
          subjectKind: true,
          validityMonths: true,
          note: true,
        },
      }),
    ]);

    const mappedEvents = events.map(mapEvent);
    const staff = mapStaffRows(staffRows);

    const models = releasedModels
      .filter((r) => r.model && r.modelId)
      .map((r) => ({
        id: r.model!.id,
        name: r.model!.tradeName || r.model!.modelName || r.model!.id,
        productSeries: r.model!.productSeries,
      }));

    const instructed = instructedRows
      .filter((r) => r.event.subjectModelId)
      .map((r) => ({ personId: r.personId, modelId: r.event.subjectModelId! }));

    const peopleWithAnyRecord = new Set(
      events.flatMap((e) => e.records.map((r) => r.personId)),
    );
    const withoutRecord = staff.filter((s) => !peopleWithAnyRecord.has(s.id)).length;
    const overdue = mappedEvents.filter((e) => e.statusKind === "overdue").length;
    const recordCount = mappedEvents.reduce((n, e) => n + e.recordCount, 0);

    const summary: TrainingSummaryDTO = {
      events: mappedEvents.length,
      records: recordCount,
      overdue,
      withoutRecord,
    };

    const types: TrainingTypeOptionDTO[] = typeRows.map((t) => ({
      code: t.code,
      label: t.label,
      legalBasis: t.legalBasis,
      subjectKind: t.subjectKind === "activity" ? "activity" : "model",
      validityMonths: t.validityMonths,
      note: t.note,
    }));

    const form: TrainingFormOptionsDTO = {
      types,
      models: models.map((m) => ({ id: m.id, name: m.name })),
      activities: [...TRAINING_ACTIVITY_OPTIONS],
      staff,
    };

    return {
      summary,
      events: mappedEvents,
      staff,
      matrix: computeInstructionMatrix(
        staff.map((s) => ({ id: s.id, name: s.name, jobTitle: s.jobTitle })),
        models,
        instructed,
      ),
      form,
    };
  },

  /**
   * Creates one TrainingEvent and N TrainingRecords (one per participant).
   * validUntil is derived from the training type's validityMonths.
   */
  async createEvent(
    ctx: TenantContext,
    input: CreateTrainingEventInput,
  ): Promise<CreateTrainingEventResultDTO> {
    requirePermission(ctx, "training:view");

    const type = await prisma.refTrainingType.findUnique({
      where: { code: input.trainingTypeCode },
    });
    if (!type) throw notFound("Unknown training type.");

    const subjectKind = type.subjectKind === "activity" ? "activity" : "model";
    const subjectModelId =
      subjectKind === "model" ? (input.subjectModelId?.trim() || null) : null;
    const subjectActivity =
      subjectKind === "activity" ? (input.subjectActivity?.trim() || null) : null;

    if (subjectKind === "model" && !subjectModelId) {
      throw badRequest("Device model is required for this training type.");
    }
    if (subjectKind === "activity" && !subjectActivity) {
      throw badRequest("Activity is required for this training type.");
    }

    if (subjectModelId) {
      const modelOk = await prisma.deviceInstance.findFirst({
        where: { tenantId: ctx.tenantId, modelId: subjectModelId },
        select: { id: true },
      });
      if (!modelOk) throw badRequest("Device model is not available in this inventory.");
    }

    const uniquePersonIds = [...new Set(input.personIds)];
    if (input.mode === "individual" && uniquePersonIds.length !== 1) {
      throw badRequest("Individual mode requires exactly one participant.");
    }

    const people = await prisma.user.findMany({
      where: {
        id: { in: uniquePersonIds },
        tenantId: ctx.tenantId,
        accountKind: "clinic",
        active: true,
        anonymisedAt: null,
      },
      select: { id: true },
    });
    if (people.length !== uniquePersonIds.length) {
      throw badRequest("One or more participants are not active clinic users.");
    }

    const heldOn = parseDateOnly(input.heldOn);
    if (Number.isNaN(heldOn.getTime())) throw badRequest("Invalid held-on date.");
    const validUntil = computeValidUntil(heldOn, type.validityMonths);
    const confirmedAt = new Date();

    const created = await prisma.$transaction(async (tx) => {
      const event = await tx.trainingEvent.create({
        data: {
          tenantId: ctx.tenantId,
          trainingTypeCode: type.code,
          subjectModelId,
          subjectActivity,
          heldOn,
          location: input.location?.trim() || null,
          instructorName: input.instructorName.trim(),
          instructorQualification: input.instructorQualification.trim(),
          instructorExternal: input.instructorExternal ?? false,
          basisDocument: input.basisDocument.trim(),
          mode: input.mode,
          recordedBy: ctx.user.name,
          recordedAt: confirmedAt,
          records: {
            create: uniquePersonIds.map((personId) => ({
              tenantId: ctx.tenantId,
              personId,
              confirmedAt,
              validUntil,
            })),
          },
        },
        include: eventInclude,
      });
      return event;
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "training",
      resourceId: created.id,
      action: "create",
      summary: `Recorded training ${type.code} for ${uniquePersonIds.length} participant(s)`,
      after: { trainingTypeCode: type.code, personCount: uniquePersonIds.length, heldOn: heldOn.toISOString() },
    });
    return { event: mapEvent(created) };
  },
};
