import { Prisma } from "@prisma/client";
import type { CreateServiceRequestResult, ServiceRequestDTO, StatusFeedbackDTO, TenantContext } from "@/interfaces";
import { OPEN_REQUEST_STATES, STARTABLE_REQUEST_STATES } from "@/constants/serviceRequest";
import { requirePermission } from "@/lib/auth/tenantContext";
import { fingerprint, newReference } from "@/lib/crypto";
import { conflict, forbidden, notFound, unprocessable } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type {
  CreateServiceRequestInput,
  ServiceRequestListScope,
  TransitionServiceRequestInput,
} from "@/schemas/serviceRequest";
import { dispatchService } from "@/services/dispatch/dispatchService";
import { toServiceRequestDTO } from "@/services/shared/mappers";

/** Open work queue — not yet finished or rejected. */
const OPEN_STATES = OPEN_REQUEST_STATES;

const STARTABLE = new Set<string>(STARTABLE_REQUEST_STATES);

const includeAll = {
  statusEvents: true,
  dispatchRecords: true,
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
    classification: input.classification ?? null,
    raisedBy: input.raisedBy,
    attachments: (input.attachments ?? []).map((a) => a.kind),
  });
}

/**
 * FA-402/404 — a `verified` proposal must be explicitly confirmed (or explicitly
 * overridden and confirmed) before the request may be sent. Pure; unit-tested.
 */
export function assertClassificationGate(classification: CreateServiceRequestInput["classification"]): void {
  if (!classification?.proposed) return;
  if (classification.proposed.confidence === "verified" && !classification.confirmed) {
    throw unprocessable("Please confirm the suggested inspection type.", { field: "classification.confirmed" });
  }
}

async function assertSubject(input: CreateServiceRequestInput, tenantId: string) {
  switch (input.subjectType) {
    case "instance": {
      const row = await prisma.deviceInstance.findFirst({ where: { id: input.subjectId, tenantId }, select: { id: true } });
      if (!row) throw unprocessable("Unknown device instance.", { field: "subjectId" });
      return;
    }
    case "model": {
      // OXID mock articles have no local row yet; accept the synthetic id.
      if (input.subjectId.startsWith("oxid-article-")) return;
      const row = await prisma.deviceModel.findUnique({ where: { id: input.subjectId }, select: { id: true } });
      if (!row) throw unprocessable("Unknown device model.", { field: "subjectId" });
      return;
    }
    case "captured": {
      // DAT-302a — a captured subject must be a service-only capture of this tenant.
      const row = await prisma.capturedArticle.findFirst({
        where: { id: input.subjectId, tenantId },
        select: { id: true, serviceOnly: true },
      });
      if (!row) throw unprocessable("Unknown captured article.", { field: "subjectId" });
      if (!row.serviceOnly) throw unprocessable("Captured article is not marked service-only.", { field: "subjectId" });
      return;
    }
  }
}

export const serviceRequestService = {
  /**
   * Section 23 — creation is a transaction: request + first StatusEvent + attachments,
   * upserted on the idempotency key (SS-701).
   */
  async create(input: CreateServiceRequestInput, ctx: TenantContext): Promise<CreateServiceRequestResult> {
    requirePermission(ctx, "requests:create");
    const { tenantId, correlationId } = ctx;

    // Server-side business rules — the client is never the authority (Section 16.2).
    if (!input.locationText.trim()) throw unprocessable("Please enter the location of use.", { field: "locationText" });
    if (!input.deliveryAddress.trim()) throw unprocessable("Please enter the delivery address.", { field: "deliveryAddress" });
    assertClassificationGate(input.classification);

    const site = await prisma.site.findFirst({ where: { id: input.site, tenantId }, select: { id: true } });
    if (!site) throw unprocessable("Please choose a site.", { field: "site" });
    await assertSubject(input, tenantId);

    const fp = requestFingerprint(input);

    const outcome = await prisma
      .$transaction(async (tx) => {
        const existing = await tx.serviceRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: includeAll });
        if (existing) {
          if (existing.tenantId !== tenantId) throw conflict("Idempotency key belongs to another tenant.");
          if (existing.fingerprint !== fp) {
            throw conflict("This idempotency key was already used for a different request.", { reference: existing.reference });
          }
          return { row: existing, created: false };
        }

        const blobs = await Promise.all(
          (input.attachments ?? []).map((a) =>
            a.url.startsWith("data:")
              ? tx.attachmentBlob.create({ data: { tenantId, kind: a.kind, dataUrl: a.url } }).then((b) => ({ kind: a.kind, url: `/api/attachments/${b.id}` }))
              : Promise.resolve({ kind: a.kind, url: a.url }),
          ),
        );

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
            locationText: input.locationText.trim(), // FA-500
            accessHint: input.accessHint?.trim() || null,
            contact: input.contact?.trim() || null,
            deliveryAddress: input.deliveryAddress.trim(), // FA-503 — stored separately, always
            classification: input.classification ? JSON.stringify(input.classification) : null,
            correlationId,
            state: "captured",
            statusEvents: { create: { state: "captured", source: "devicecare", actor: ctx.user.name } },
            attachments: { create: blobs },
          },
          include: includeAll,
        });
        return { row, created: true };
      })
      .catch(async (error) => {
        // Two identical requests raced past the findUnique — the unique index is the final arbiter.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const row = await prisma.serviceRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: includeAll });
          if (row) return { row, created: false };
        }
        throw error;
      });

    let dto = toServiceRequestDTO(outcome.row);

    if (outcome.created) {
      logger.info("service_request.created", { correlationId, reference: dto.reference, tenantId });
      try {
        await dispatchService.dispatch(dto, tenantId, correlationId, ctx.user);
      } catch (error) {
        // Dispatch trouble never undoes a persisted request; it is visible in DispatchRecord.
        logger.error("service_request.dispatch_failed", { correlationId, reference: dto.reference, error: error instanceof Error ? error.message : String(error) });
      }
      const fresh = await prisma.serviceRequest.findUnique({ where: { id: dto.id }, include: includeAll });
      if (fresh) dto = toServiceRequestDTO(fresh);
    }

    return { request: dto, created: outcome.created };
  },

  async getByReference(reference: string, tenantId: string): Promise<ServiceRequestDTO | null> {
    const row = await prisma.serviceRequest.findFirst({ where: { reference, tenantId }, include: includeAll });
    return row ? toServiceRequestDTO(row) : null;
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
    return rows.map(toServiceRequestDTO);
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
      select: { id: true, state: true },
    });
    if (!existing) throw notFound(`Unknown service request reference ${reference}.`);

    const from = existing.state;
    const to = input.state;

    if (to === "in_progress") {
      if (!STARTABLE.has(from) && from !== "in_progress") {
        throw unprocessable(`Cannot start work from state "${from}".`, { field: "state", from, to });
      }
      if (from === "in_progress") {
        const row = await prisma.serviceRequest.findFirst({ where: { id: existing.id }, include: includeAll });
        if (!row) throw notFound(`Unknown service request reference ${reference}.`);
        return toServiceRequestDTO(row);
      }
    } else if (to === "completed") {
      if (from !== "in_progress") {
        throw unprocessable(`Complete requires state "in_progress" (currently "${from}").`, { field: "state", from, to });
      }
      if (!input.note?.trim()) {
        throw unprocessable("Please enter a work note when completing maintenance.", { field: "note" });
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

    logger.info("service_request.transition", {
      correlationId: ctx.correlationId,
      reference,
      from,
      to,
      actor: ctx.user.id,
    });

    return toServiceRequestDTO(row);
  },

  /**
   * FA-601/602 — state only ever changes through a StatusEvent driven by external
   * feedback. Unknown references are a 404, never a silent discard.
   */
  async applyStatusFeedback(reference: string, feedback: StatusFeedbackDTO): Promise<ServiceRequestDTO> {
    const existing = await prisma.serviceRequest.findUnique({ where: { reference }, select: { id: true } });
    if (!existing) throw notFound(`Unknown service request reference ${reference}.`);
    const row = await prisma.$transaction(async (tx) => {
      await tx.statusEvent.create({
        data: {
          serviceRequestId: existing.id,
          state: feedback.state,
          source: feedback.source,
          actor: feedback.actor ?? null,
          note: [feedback.note, feedback.externalReference ? `ext:${feedback.externalReference}` : null].filter(Boolean).join(" ") || null,
        },
      });
      return tx.serviceRequest.update({ where: { id: existing.id }, data: { state: feedback.state }, include: includeAll });
    });
    return toServiceRequestDTO(row);
  },
};
