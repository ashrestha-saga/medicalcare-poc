import { Prisma, type ServiceRequestState } from "@prisma/client";
import type {
  CreateServiceRequestResult,
  ExecutorOrgDTO,
  ServiceRequestDTO,
  StatusFeedbackDTO,
  TenantWorkContext,
} from "@/interfaces";
import { OPEN_REQUEST_STATES, STARTABLE_REQUEST_STATES } from "@/constants/serviceRequest";
import { actorFromContext, actorSystem } from "@/lib/auth/actorContext";
import { blobMetaFromDataUrl } from "@/lib/blobMeta";
import { requirePermission } from "@/lib/auth/tenantContext";
import { recordAudit } from "@/services/audit/auditService";
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
import { recordDutyCompletion } from "@/services/registration/recordDutyCompletion";
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
  assigneeUser: { select: { id: true, name: true } },
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
  inspectionRuns: {
    orderBy: { performedAt: "desc" as const },
    take: 3,
    select: {
      result: true,
      note: true,
      performedAt: true,
      performedByName: true,
      dutyPerformanceId: true,
      catalogue: { select: { code: true, label: true } },
    },
  },
  performances: {
    orderBy: { performedAt: "desc" as const },
    take: 1,
    select: {
      result: true,
      note: true,
      performedAt: true,
      performedBy: true,
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

/** FA-715 / SCH-09 — roll duty via shared completion helper when an assignment completes. */
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

  await prisma.$transaction(async (tx) => {
    await recordDutyCompletion(tx, {
      tenantId: args.tenantId,
      duty,
      performedAt: new Date(),
      performedBy: args.performedBy,
      note: args.note,
      source: args.source,
      serviceRequestId: args.serviceRequestId,
      unitEventSuffix: "via assignment",
    });
  });
}

export const serviceRequestService = {
  /**
   * Section 23 — creation is a transaction: request + first StatusEvent + attachments,
   * upserted on the idempotency key (SS-701).
   */
  async create(input: CreateServiceRequestInput, ctx: TenantWorkContext): Promise<CreateServiceRequestResult> {
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
          (input.attachments ?? []).map((a) => {
            if (!a.url.startsWith("data:")) return Promise.resolve({ kind: a.kind, url: a.url });
            const meta = blobMetaFromDataUrl(a.url);
            return tx.attachmentBlob
              .create({
                data: {
                  tenantId,
                  kind: a.kind,
                  dataUrl: a.url,
                  contentType: meta.contentType,
                  byteSize: meta.byteSize,
                },
              })
              .then((b) => ({ kind: a.kind, url: `/api/attachments/${b.id}` }));
          }),
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
                tenantId,
                state: "captured",
                source: "devicecare",
                actor: ctx.user.name,
                note: historyNote,
              },
            },
            attachments: { create: blobs.map((b) => ({ ...b, tenantId })) },
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

    if (outcome.created) {
      await recordAudit({
        actor: actorFromContext(ctx),
        resource: "request",
        resourceId: dto.reference,
        action: "create",
        summary: `Created service request ${dto.reference}`,
        after: { reference: dto.reference, serviceType: dto.serviceType, subjectId: input.subjectId },
      });
    }

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
                  tenantId,
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
    ctx: TenantWorkContext,
    opts: { scope: ServiceRequestListScope; state?: string; limit?: number } = { scope: "mine" },
  ): Promise<ServiceRequestDTO[]> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.ServiceRequestWhereInput = { tenantId: ctx.tenantId };

    if (opts.scope === "mine") {
      requirePermission(ctx, "requests:view-mine");
      where.raisedById = ctx.user.id;
    } else if (opts.scope === "open") {
      requirePermission(ctx, "requests:view-open");
      where.state = { in: [...OPEN_STATES] as Prisma.EnumServiceRequestStateFilter["in"] };
    } else if (opts.scope === "all") {
      requirePermission(ctx, "requests:view-all");
    }

    if (opts.state) {
      where.state = opts.state as Prisma.EnumServiceRequestStateFilter;
    }

    const rows = await prisma.serviceRequest.findMany({
      where,
      include: includeAll,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return Promise.all(rows.map((r) => toDto(r)));
  },

  async listExecutors(ctx: TenantWorkContext): Promise<ExecutorOrgDTO[]> {
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
    ctx: TenantWorkContext,
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
          tenantId: existing.tenantId,
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

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "request",
      resourceId: reference,
      action: "update",
      summary: `Allocated ${reference} to ${org.name}`,
      after: { executorOrgId: org.id, executorName: org.name },
    });
    return toDto(row);
  },

  /** FA-714 — transmit to the allocated org's enabled channels and lock allocation. */
  async transmit(reference: string, ctx: TenantWorkContext): Promise<ServiceRequestDTO> {
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
          tenantId: existing.tenantId,
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

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "request",
      resourceId: reference,
      action: "transition",
      summary: `Transmitted ${reference}`,
      before: { state: existing.state },
      after: { state: "transmitted" },
    });
    return toDto(row);
  },

  /**
   * Withdraw a wrong assignment — deletes the ServiceRequest and related rows so the
   * duty can be reassigned. Only allowed before transmit; locked once handed off.
   */
  async withdraw(reference: string, ctx: TenantWorkContext): Promise<{ reference: string }> {
    requirePermission(ctx, "requests:transition");
    const existing = await prisma.serviceRequest.findFirst({
      where: { reference, tenantId: ctx.tenantId },
      select: { id: true, reference: true, state: true, dutyId: true, transmittedAt: true },
    });
    if (!existing) throw notFound(`Unknown service request reference ${reference}.`);
    if (existing.transmittedAt) {
      throw unprocessable("Cannot withdraw after transmission — the assignment is locked.", {
        field: "transmittedAt",
      });
    }
    if (existing.state === "completed") {
      throw unprocessable("Completed assignments cannot be withdrawn.", { field: "state" });
    }
    if (existing.state === "rejected") {
      throw unprocessable("Assignment already withdrawn.", { field: "state" });
    }

    const sealedRun = await prisma.inspectionRun.findFirst({
      where: { serviceRequestId: existing.id, dutyPerformanceId: { not: null } },
      select: { id: true },
    });
    if (sealedRun) {
      throw unprocessable("Cannot withdraw — a sealed inspection protocol exists.", {
        field: "inspectionRun",
      });
    }

    await prisma.$transaction(async (tx) => {
      const runs = await tx.inspectionRun.findMany({
        where: { serviceRequestId: existing.id },
        select: { id: true },
      });
      const runIds = runs.map((r) => r.id);
      if (runIds.length) {
        await tx.inspectionStepResult.deleteMany({ where: { runId: { in: runIds } } });
        await tx.inspectionRun.deleteMany({ where: { id: { in: runIds } } });
      }
      await tx.statusEvent.deleteMany({ where: { serviceRequestId: existing.id } });
      await tx.attachment.deleteMany({ where: { serviceRequestId: existing.id } });
      await tx.dispatchOutbox.deleteMany({ where: { serviceRequestId: existing.id } });
      await tx.dispatchRecord.deleteMany({ where: { serviceRequestId: existing.id } });
      await tx.dutyPerformance.deleteMany({ where: { serviceRequestId: existing.id } });
      await tx.serviceRequest.delete({ where: { id: existing.id } });
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "request",
      resourceId: reference,
      action: "delete",
      summary: `Withdrew assignment ${reference}`,
      before: { state: existing.state, dutyId: existing.dutyId },
    });

    return { reference: existing.reference };
  },

  /**
   * In-app Start / Complete — requires requests:transition. Appends StatusEvent;
   * DeviceCare is the clinic-side system of record (OXID webhook remains separate).
   */
  async transition(
    reference: string,
    input: TransitionServiceRequestInput,
    ctx: TenantWorkContext,
  ): Promise<ServiceRequestDTO> {
    requirePermission(ctx, "requests:transition");

    const existing = await prisma.serviceRequest.findFirst({
      where: { reference, tenantId: ctx.tenantId },
      select: { id: true, state: true, dutyId: true, executorOrgId: true, tenantId: true },
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
          tenantId: existing.tenantId,
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
    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "request",
      resourceId: reference,
      action: "transition",
      summary: `Transitioned ${reference} from ${from} to ${to}`,
      before: { state: from },
      after: { state: to, note },
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
    const nextState = feedback.state as ServiceRequestState;
    const row = await prisma.$transaction(async (tx) => {
      await tx.statusEvent.create({
        data: {
          tenantId: existing.tenantId,
          serviceRequestId: existing.id,
          state: nextState,
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
        data: { state: nextState },
        include: includeAll,
      });
    });

    await recordAudit({
      actor: actorSystem({
        tenantId: existing.tenantId,
        source: feedback.source,
      }),
      resource: "request",
      resourceId: reference,
      action: "transition",
      summary: `External status ${feedback.state} on ${reference}`,
      after: { state: feedback.state, source: feedback.source, actor: feedback.actor ?? null },
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
