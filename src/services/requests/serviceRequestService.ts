import { Prisma } from "@prisma/client";
import type {
  CreateServiceRequestResult,
  ExecutorOrgDTO,
  ServiceRequestDTO,
  StatusFeedbackDTO,
  TenantContext,
} from "@/interfaces";
import { OPEN_REQUEST_STATES, STARTABLE_REQUEST_STATES } from "@/constants/serviceRequest";
import { requirePermission } from "@/lib/auth/tenantContext";
import { fingerprint, newReference } from "@/lib/crypto";
import { conflict, forbidden, notFound, unprocessable } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type {
  AllocateServiceRequestInput,
  CreateServiceRequestInput,
  ServiceRequestListScope,
  TransitionServiceRequestInput,
} from "@/schemas/serviceRequest";
import { dispatchService } from "@/services/dispatch/dispatchService";
import { computeDutyDueAt } from "@/services/registration/dueDate";
import {
  toServiceRequestDTO,
  type ServiceRequestWithRelations,
} from "@/services/shared/mappers";

/** Open work queue — not yet finished or rejected. */
const OPEN_STATES = OPEN_REQUEST_STATES;

const STARTABLE = new Set<string>(STARTABLE_REQUEST_STATES);

const includeAll = {
  statusEvents: true,
  dispatchRecords: true,
  executorOrg: true,
  duty: {
    select: {
      id: true,
      title: true,
      dutyKey: true,
      basisText: true,
      dueAt: true,
      inspectionTypeCode: true,
    },
  },
  _count: { select: { attachments: true } },
} as const;

/** 23.1 — what makes two submissions "the same": everything the user chose, minus transport noise. */
export function requestFingerprint(input: CreateServiceRequestInput): string {
  return fingerprint({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    serviceType: input.serviceType,
    priority: input.priority ?? null,
    note: input.note ?? null,
    site: input.site,
    locationText: input.locationText,
    accessHint: input.accessHint ?? null,
    contact: input.contact ?? null,
    deliveryAddress: input.deliveryAddress,
    raisedBy: input.raisedBy,
    dutyId: input.dutyId ?? null,
    source: input.source ?? "app",
    attachments: (input.attachments ?? []).map((a) => a.kind),
  });
}

async function assertSubject(input: CreateServiceRequestInput, tenantId: string) {
  switch (input.subjectType) {
    case "instance": {
      const row = await prisma.deviceInstance.findFirst({
        where: { id: input.subjectId, tenantId },
        select: { id: true },
      });
      if (!row) throw unprocessable("Unknown device instance.", { field: "subjectId" });
      return;
    }
    case "model": {
      if (input.subjectId.startsWith("oxid-article-")) return;
      const row = await prisma.deviceModel.findUnique({
        where: { id: input.subjectId },
        select: { id: true },
      });
      if (!row) throw unprocessable("Unknown device model.", { field: "subjectId" });
      return;
    }
    case "captured": {
      const row = await prisma.capturedArticle.findFirst({
        where: { id: input.subjectId, tenantId },
        select: { id: true, serviceOnly: true },
      });
      if (!row) throw unprocessable("Unknown captured article.", { field: "subjectId" });
      if (!row.serviceOnly) {
        throw unprocessable("Captured article is not marked service-only.", { field: "subjectId" });
      }
      return;
    }
  }
}

async function attachDeviceContext(
  row: ServiceRequestWithRelations,
): Promise<ServiceRequestWithRelations> {
  if (row.subjectType === "instance") {
    const subjectInstance = await prisma.deviceInstance.findFirst({
      where: { id: row.subjectId, tenantId: row.tenantId },
      select: {
        inventoryNumber: true,
        model: { select: { tradeName: true, modelName: true, udiDi: true } },
      },
    });
    return { ...row, subjectInstance };
  }
  if (row.subjectType === "model") {
    const subjectModel = await prisma.deviceModel.findUnique({
      where: { id: row.subjectId },
      select: { tradeName: true, modelName: true, udiDi: true, manufacturer: true },
    });
    return { ...row, subjectModel };
  }
  return row;
}

async function toDto(row: ServiceRequestWithRelations): Promise<ServiceRequestDTO> {
  return toServiceRequestDTO(await attachDeviceContext(row));
}

/** FA-715 — roll duty due date and record performance when an assignment completes. */
async function writeDutyPerformanceOnComplete(args: {
  tenantId: string;
  dutyId: string;
  serviceRequestId: string;
  performedBy: string;
  note: string | null;
  source: string;
}) {
  const duty = await prisma.deviceDuty.findFirst({
    where: { id: args.dutyId, tenantId: args.tenantId, applicable: true, suspendedAt: null },
  });
  if (!duty) return;

  const performedAt = new Date();
  const nextDue = computeDutyDueAt({
    deadlineAnchor: duty.deadlineAnchor,
    referenceDate: duty.referenceDate,
    lastCompletedAt: performedAt,
    intervalValue: duty.intervalValue,
    intervalUnit: duty.intervalUnit,
  });

  await prisma.$transaction(async (tx) => {
    await tx.dutyPerformance.create({
      data: {
        tenantId: args.tenantId,
        deviceDutyId: duty.id,
        serviceRequestId: args.serviceRequestId,
        performedAt,
        result: "passed",
        note: args.note,
        performedBy: args.performedBy,
        source: args.source,
      },
    });
    await tx.deviceDuty.update({
      where: { id: duty.id },
      data: {
        lastCompletedAt: performedAt,
        dueAt: nextDue,
        notifyStage: null,
        lastNotifiedAt: null,
      },
    });
    await tx.deviceUnitEvent.create({
      data: {
        tenantId: args.tenantId,
        deviceInstanceId: duty.deviceInstanceId,
        actor: args.performedBy,
        action: "duty_complete",
        note: [
          duty.title ?? duty.dutyKey,
          nextDue ? `next due ${nextDue.toISOString().slice(0, 10)}` : "no calendar due",
          `via assignment`,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    });
  });
}

export const serviceRequestService = {
  /**
   * Section 23 — creation is a transaction: request + first StatusEvent + attachments,
   * upserted on the idempotency key (SS-701).
   */
  async create(input: CreateServiceRequestInput, ctx: TenantContext): Promise<CreateServiceRequestResult> {
    requirePermission(ctx, "requests:create");
    const { tenantId, correlationId } = ctx;

    if (!input.locationText.trim()) {
      throw unprocessable("Please enter the location of use.", { field: "locationText" });
    }
    if (!input.deliveryAddress.trim()) {
      throw unprocessable("Please enter the delivery address.", { field: "deliveryAddress" });
    }
    const site = await prisma.site.findFirst({
      where: { id: input.site, tenantId },
      select: { id: true },
    });
    if (!site) throw unprocessable("Please choose a site.", { field: "site" });
    await assertSubject(input, tenantId);

    if (input.dutyId) {
      const duty = await prisma.deviceDuty.findFirst({
        where: { id: input.dutyId, tenantId, applicable: true, suspendedAt: null },
        select: { id: true },
      });
      if (!duty) throw unprocessable("Unknown or suspended duty.", { field: "dutyId" });
    }

    const source = input.source ?? (input.dutyId ? "due_date" : "app");
    const deferDispatch = Boolean(input.deferDispatch ?? input.dutyId);
    const fp = requestFingerprint(input);

    const outcome = await prisma
      .$transaction(async (tx) => {
        const existing = await tx.serviceRequest.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: includeAll,
        });
        if (existing) {
          if (existing.tenantId !== tenantId) throw conflict("Idempotency key belongs to another tenant.");
          if (existing.fingerprint !== fp) {
            throw conflict("This idempotency key was already used for a different request.", {
              reference: existing.reference,
            });
          }
          return { row: existing, created: false };
        }

        const blobs = await Promise.all(
          (input.attachments ?? []).map((a) =>
            a.url.startsWith("data:")
              ? tx.attachmentBlob
                  .create({ data: { tenantId, kind: a.kind, dataUrl: a.url } })
                  .then((b) => ({ kind: a.kind, url: `/api/attachments/${b.id}` }))
              : Promise.resolve({ kind: a.kind, url: a.url }),
          ),
        );

        const historyNote =
          source === "due_date" ? "Created from a due date" : "Created from service request";

        const row = await tx.serviceRequest.create({
          data: {
            reference: newReference("SR"),
            idempotencyKey: input.idempotencyKey,
            fingerprint: fp,
            tenantId,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            serviceType: input.serviceType,
            priority: input.priority ?? null,
            note: input.note?.trim() || null,
            raisedBy: ctx.user.name,
            raisedById: ctx.user.id,
            siteId: input.site,
            locationText: input.locationText.trim(),
            accessHint: input.accessHint?.trim() || null,
            contact: input.contact?.trim() || null,
            deliveryAddress: input.deliveryAddress.trim(),
            classification: null,
            correlationId,
            state: "captured",
            source,
            dutyId: input.dutyId ?? null,
            statusEvents: {
              create: {
                state: "captured",
                source: "devicecare",
                actor: ctx.user.name,
                note: historyNote,
              },
            },
            attachments: { create: blobs },
          },
          include: includeAll,
        });
        return { row, created: true };
      })
      .catch(async (error) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const row = await prisma.serviceRequest.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
            include: includeAll,
          });
          if (row) return { row, created: false };
        }
        throw error;
      });

    let dto = await toDto(outcome.row);

    if (outcome.created && !deferDispatch) {
      logger.info("service_request.created", { correlationId, reference: dto.reference, tenantId });
      try {
        // App-created requests: auto-allocate in-house org and hit its enabled channels.
        const internal = await prisma.executorOrg.findFirst({
          where: { tenantId, code: "O-INT", active: true },
        });
        if (internal) {
          await prisma.serviceRequest.update({
            where: { id: dto.id },
            data: {
              executorOrgId: internal.id,
              allocatedAt: new Date(),
              allocatedBy: ctx.user.name,
            },
          });
          const withOrg = await prisma.serviceRequest.findUnique({
            where: { id: dto.id },
            include: includeAll,
          });
          if (withOrg) dto = await toDto(withOrg);

          const outcomes = await dispatchService.dispatch(dto, tenantId, correlationId, ctx.user, {
            executorOrgId: internal.id,
          });
          // Internal with no targets still locks as transmitted (clinic-side handoff).
          if (outcomes.length === 0 || outcomes.some((o) => o.result.success)) {
            await prisma.serviceRequest.update({
              where: { id: dto.id },
              data: { transmittedAt: new Date(), state: "transmitted" },
            });
            if (outcomes.length === 0) {
              await prisma.statusEvent.create({
                data: {
                  serviceRequestId: dto.id,
                  state: "transmitted",
                  source: "devicecare",
                  actor: ctx.user.name,
                  note: `Transmitted in-house (${internal.name}) — no outbound channels`,
                },
              });
            }
          }
        }
      } catch (error) {
        logger.error("service_request.dispatch_failed", {
          correlationId,
          reference: dto.reference,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      const fresh = await prisma.serviceRequest.findUnique({
        where: { id: dto.id },
        include: includeAll,
      });
      if (fresh) dto = await toDto(fresh);
    } else if (outcome.created) {
      logger.info("service_request.created_deferred", {
        correlationId,
        reference: dto.reference,
        tenantId,
        source,
      });
    }

    return { request: dto, created: outcome.created };
  },

  async getByReference(reference: string, tenantId: string): Promise<ServiceRequestDTO | null> {
    const row = await prisma.serviceRequest.findFirst({
      where: { reference, tenantId },
      include: includeAll,
    });
    return row ? toDto(row) : null;
  },

  async list(
    ctx: TenantContext,
    opts: { scope: ServiceRequestListScope; state?: string; limit?: number } = { scope: "mine" },
  ): Promise<ServiceRequestDTO[]> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.ServiceRequestWhereInput = { tenantId: ctx.tenantId };

    if (opts.scope === "mine") {
      requirePermission(ctx, "requests:view-mine");
      where.raisedById = ctx.user.id;
    } else if (opts.scope === "open") {
      requirePermission(ctx, "requests:view-open");
      where.state = { in: [...OPEN_STATES] };
    } else if (opts.scope === "all") {
      requirePermission(ctx, "requests:view-all");
    }

    if (opts.state) {
      where.state = opts.state;
    }

    const rows = await prisma.serviceRequest.findMany({
      where,
      include: includeAll,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return Promise.all(rows.map((r) => toDto(r)));
  },

  async listExecutors(ctx: TenantContext): Promise<ExecutorOrgDTO[]> {
    requirePermission(ctx, "requests:view-mine");
    const rows = await prisma.executorOrg.findMany({
      where: { tenantId: ctx.tenantId, active: true },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      kind: r.kind,
      active: r.active,
    }));
  },

  /** FA-713 — allocate executor; locked after transmit. */
  async allocate(
    reference: string,
    input: AllocateServiceRequestInput,
    ctx: TenantContext,
  ): Promise<ServiceRequestDTO> {
    requirePermission(ctx, "requests:transition");
    const existing = await prisma.serviceRequest.findFirst({
      where: { reference, tenantId: ctx.tenantId },
      include: includeAll,
    });
    if (!existing) throw notFound(`Unknown service request reference ${reference}.`);
    if (existing.transmittedAt) {
      throw unprocessable("Allocation is locked after transmission.", { field: "executorOrgId" });
    }

    const org = await prisma.executorOrg.findFirst({
      where: { id: input.executorOrgId, tenantId: ctx.tenantId, active: true },
    });
    if (!org) throw unprocessable("Unknown executor.", { field: "executorOrgId" });

    const row = await prisma.$transaction(async (tx) => {
      await tx.statusEvent.create({
        data: {
          serviceRequestId: existing.id,
          state: existing.state,
          source: "devicecare",
          actor: ctx.user.name,
          note: `Allocated to ${org.name} · ${org.kind}`,
        },
      });
      return tx.serviceRequest.update({
        where: { id: existing.id },
        data: {
          executorOrgId: org.id,
          allocatedAt: new Date(),
          allocatedBy: ctx.user.name,
        },
        include: includeAll,
      });
    });

    return toDto(row);
  },

  /** FA-714 — transmit to the allocated org's enabled channels and lock allocation. */
  async transmit(reference: string, ctx: TenantContext): Promise<ServiceRequestDTO> {
    requirePermission(ctx, "requests:transition");
    const existing = await prisma.serviceRequest.findFirst({
      where: { reference, tenantId: ctx.tenantId },
      include: includeAll,
    });
    if (!existing) throw notFound(`Unknown service request reference ${reference}.`);
    if (!existing.executorOrgId || !existing.executorOrg) {
      throw unprocessable("Allocate an executor before transmitting.", { field: "executorOrgId" });
    }
    if (existing.transmittedAt) {
      return toDto(existing);
    }

    const org = existing.executorOrg;
    const enabledCount = await prisma.dispatchTarget.count({
      where: { tenantId: ctx.tenantId, executorOrgId: org.id, enabled: true },
    });

    // External partners must have at least one active channel; internal may hand off locally.
    if (enabledCount === 0 && org.kind !== "internal") {
      throw unprocessable(
        `${org.name} has no enabled dispatch channels (mail/API). Configure DispatchTarget first.`,
        { field: "transmit" },
      );
    }

    let dto = await toDto(existing);
    let outcomes: Awaited<ReturnType<typeof dispatchService.dispatch>> = [];
    if (enabledCount > 0) {
      try {
        outcomes = await dispatchService.dispatch(dto, ctx.tenantId, ctx.correlationId, ctx.user, {
          executorOrgId: org.id,
          updateState: false,
        });
      } catch (error) {
        logger.error("service_request.transmit_failed", {
          correlationId: ctx.correlationId,
          reference,
          error: error instanceof Error ? error.message : String(error),
        });
        throw unprocessable("Transmission failed — check dispatch targets.", { field: "transmit" });
      }

      if (outcomes.length > 0 && !outcomes.some((o) => o.result.success)) {
        throw unprocessable("Transmission failed — all channels rejected the request.", {
          field: "transmit",
        });
      }
    }

    const successLabels = outcomes.filter((o) => o.result.success).map((o) => o.target);
    const note =
      successLabels.length > 0
        ? `Transmitted to ${org.name} · ${successLabels.join(", ")}`
        : `Transmitted to ${org.name} (no outbound channels)`;

    const row = await prisma.$transaction(async (tx) => {
      await tx.statusEvent.create({
        data: {
          serviceRequestId: existing.id,
          state: "transmitted",
          source: "devicecare",
          actor: ctx.user.name,
          note,
        },
      });
      return tx.serviceRequest.update({
        where: { id: existing.id },
        data: { state: "transmitted", transmittedAt: new Date() },
        include: includeAll,
      });
    });

    return toDto(row);
  },

  /**
   * In-app Start / Complete — requires requests:transition. Appends StatusEvent;
   * DeviceCare is the clinic-side system of record (OXID webhook remains separate).
   */
  async transition(
    reference: string,
    input: TransitionServiceRequestInput,
    ctx: TenantContext,
  ): Promise<ServiceRequestDTO> {
    requirePermission(ctx, "requests:transition");

    const existing = await prisma.serviceRequest.findFirst({
      where: { reference, tenantId: ctx.tenantId },
      select: { id: true, state: true, dutyId: true, executorOrgId: true },
    });
    if (!existing) throw notFound(`Unknown service request reference ${reference}.`);

    const from = existing.state;
    const to = input.state;

    if (to === "in_progress") {
      if (!STARTABLE.has(from) && from !== "in_progress") {
        throw unprocessable(`Cannot start work from state "${from}".`, { field: "state", from, to });
      }
      if (from === "in_progress") {
        const row = await prisma.serviceRequest.findFirst({
          where: { id: existing.id },
          include: includeAll,
        });
        if (!row) throw notFound(`Unknown service request reference ${reference}.`);
        return toDto(row);
      }
    } else if (to === "completed") {
      if (from !== "in_progress") {
        throw unprocessable(`Complete requires state "in_progress" (currently "${from}").`, {
          field: "state",
          from,
          to,
        });
      }
      if (!input.note?.trim()) {
        throw unprocessable("Please enter a work note when completing maintenance.", {
          field: "note",
        });
      }
    } else {
      throw forbidden(`Transition to "${to}" is not allowed.`);
    }

    const note = input.note?.trim() || null;
    const row = await prisma.$transaction(async (tx) => {
      await tx.statusEvent.create({
        data: {
          serviceRequestId: existing.id,
          state: to,
          source: "devicecare",
          actor: ctx.user.name,
          note,
        },
      });
      return tx.serviceRequest.update({
        where: { id: existing.id },
        data: { state: to },
        include: includeAll,
      });
    });

    if (to === "completed" && existing.dutyId) {
      await writeDutyPerformanceOnComplete({
        tenantId: ctx.tenantId,
        dutyId: existing.dutyId,
        serviceRequestId: existing.id,
        performedBy: ctx.user.name,
        note,
        source: "assignment",
      });
    }

    logger.info("service_request.transition", {
      correlationId: ctx.correlationId,
      reference,
      from,
      to,
      actor: ctx.user.id,
    });

    return toDto(row);
  },

  /**
   * FA-601/602 — state only ever changes through a StatusEvent driven by external
   * feedback. Unknown references are a 404, never a silent discard.
   */
  async applyStatusFeedback(reference: string, feedback: StatusFeedbackDTO): Promise<ServiceRequestDTO> {
    const existing = await prisma.serviceRequest.findUnique({
      where: { reference },
      select: { id: true, tenantId: true, dutyId: true },
    });
    if (!existing) throw notFound(`Unknown service request reference ${reference}.`);
    const row = await prisma.$transaction(async (tx) => {
      await tx.statusEvent.create({
        data: {
          serviceRequestId: existing.id,
          state: feedback.state,
          source: feedback.source,
          actor: feedback.actor ?? null,
          note:
            [feedback.note, feedback.externalReference ? `ext:${feedback.externalReference}` : null]
              .filter(Boolean)
              .join(" ") || null,
        },
      });
      return tx.serviceRequest.update({
        where: { id: existing.id },
        data: { state: feedback.state },
        include: includeAll,
      });
    });

    if (feedback.state === "completed" && existing.dutyId) {
      await writeDutyPerformanceOnComplete({
        tenantId: existing.tenantId,
        dutyId: existing.dutyId,
        serviceRequestId: existing.id,
        performedBy: feedback.actor ?? feedback.source,
        note: feedback.note ?? null,
        source: "assignment",
      });
    }

    return toDto(row);
  },
};
