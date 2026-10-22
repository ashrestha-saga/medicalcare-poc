import type { AuthorityNotificationDTO, TenantContext } from "@/interfaces";
import { actorAttribution } from "@/lib/auth/attribution";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { blobMetaFromDataUrl } from "@/lib/blobMeta";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import type {
  AuthorityKind,
  NotificationChannel,
  NotificationDocumentRole,
  NotificationKind,
  NotificationState,
} from "@prisma/client";

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function mapRow(row: {
  id: string;
  kind: NotificationKind;
  state: NotificationState;
  recipientName: string;
  channel: NotificationChannel;
  authorityKind: string | null;
  incidentId: string | null;
  findingId: string | null;
  deviceInstanceId: string | null;
  siteId: string | null;
  subject: string;
  bodyText: string | null;
  dueAt: Date | null;
  sentAt: Date | null;
  sentByName: string | null;
  acknowledgedAt: Date | null;
  reference: string | null;
  recordedByName: string;
  recordedAt: Date;
}): AuthorityNotificationDTO {
  return {
    id: row.id,
    kind: row.kind,
    state: row.state,
    recipientName: row.recipientName,
    channel: row.channel,
    authorityKind: row.authorityKind,
    incidentId: row.incidentId,
    findingId: row.findingId,
    deviceInstanceId: row.deviceInstanceId,
    siteId: row.siteId,
    subject: row.subject,
    bodyText: row.bodyText,
    dueAt: isoDate(row.dueAt),
    sentAt: isoDate(row.sentAt),
    sentByName: row.sentByName,
    acknowledgedAt: isoDate(row.acknowledgedAt),
    reference: row.reference,
    recordedByName: row.recordedByName,
    recordedAt: row.recordedAt.toISOString(),
  };
}

/** Exactly one subject FK — enforced in application (schema cannot). */
export function assertExactlyOneSubject(args: {
  incidentId?: string | null;
  findingId?: string | null;
  deviceInstanceId?: string | null;
  siteId?: string | null;
}): void {
  const set = [args.incidentId, args.findingId, args.deviceInstanceId, args.siteId].filter(Boolean);
  if (set.length !== 1) {
    throw badRequest("Exactly one of incidentId, findingId, deviceInstanceId, siteId is required");
  }
}

export type RecordNotificationDocumentInput = {
  role: NotificationDocumentRole;
  externalRef?: string | null;
  dataUrl?: string | null;
};

export type RecordNotificationInput = {
  kind: NotificationKind;
  recipientName: string;
  channel: NotificationChannel;
  subject: string;
  bodyText?: string | null;
  sentAt: string;
  reference?: string | null;
  dueAt?: string | null;
  authorityKind?: AuthorityKind | null;
  incidentId?: string | null;
  findingId?: string | null;
  deviceInstanceId?: string | null;
  siteId?: string | null;
  documents?: RecordNotificationDocumentInput[];
};

async function requireSubjectExists(input: RecordNotificationInput): Promise<void> {
  if (input.incidentId) {
    const row = await prisma.deviceIncident.findFirst({ where: { id: input.incidentId } });
    if (!row) throw notFound("Incident not found");
  }
  if (input.findingId) {
    const row = await prisma.authorityFinding.findFirst({ where: { id: input.findingId } });
    if (!row) throw notFound("Finding not found");
  }
  if (input.deviceInstanceId) {
    const row = await prisma.deviceInstance.findFirst({ where: { id: input.deviceInstanceId } });
    if (!row) throw notFound("Device not found");
  }
  if (input.siteId) {
    const row = await prisma.site.findFirst({ where: { id: input.siteId } });
    if (!row) throw notFound("Site not found");
  }
}

export function requiredPermissionForNotification(input: {
  kind: NotificationKind;
  incidentId?: string | null;
}): "incidents:manage" | "authority:view" {
  if (input.kind === "incident" || input.incidentId) return "incidents:manage";
  return "authority:view";
}

async function assertIncidentNotAlreadyReported(incidentId: string): Promise<void> {
  const incident = await prisma.deviceIncident.findFirst({
    where: { id: incidentId },
    select: { reportedAt: true },
  });
  if (incident?.reportedAt) {
    throw badRequest("Incident already reported — open Authority notifications to amend");
  }
  const existing = await prisma.authorityNotification.findFirst({
    where: {
      incidentId,
      kind: "incident",
      state: { in: ["sent", "acknowledged", "closed"] },
    },
    select: { id: true },
  });
  if (existing) {
    throw badRequest("Incident already has an authority notification");
  }
}

export const authorityNotificationService = {
  async list(
    ctx: TenantContext,
    query: { state?: NotificationState; kind?: NotificationKind; incidentId?: string } = {},
  ): Promise<AuthorityNotificationDTO[]> {
    requirePermission(ctx, "authority:view");
    const rows = await prisma.authorityNotification.findMany({
      where: {
        ...(query.state ? { state: query.state } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.incidentId ? { incidentId: query.incidentId } : {}),
      },
      orderBy: [{ state: "asc" }, { recordedAt: "desc" }],
      take: 300,
    });
    return rows.map(mapRow);
  },

  /**
   * Record that a named person sent (or drafted) a notification.
   * Does not transmit. Exactly one of incident / finding / device / site.
   */
  async record(ctx: TenantContext, input: RecordNotificationInput): Promise<AuthorityNotificationDTO> {
    requirePermission(ctx, requiredPermissionForNotification(input));
    assertExactlyOneSubject(input);
    await requireSubjectExists(input);

    if (input.kind === "incident") {
      if (!input.incidentId) throw badRequest("incident kind requires incidentId");
      await assertIncidentNotAlreadyReported(input.incidentId);
    }
    if (input.kind === "finding_remediation" && !input.findingId) {
      throw badRequest("finding_remediation kind requires findingId");
    }

    const actor = actorAttribution(ctx);
    const sentAt = new Date(`${input.sentAt}T00:00:00.000Z`);
    const dueAt = input.dueAt ? new Date(`${input.dueAt}T00:00:00.000Z`) : null;
    const docs = input.documents ?? [];

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.authorityNotification.create({
        data: {
          tenantId: ctx.tenantId,
          kind: input.kind,
          state: "sent",
          authorityKind: input.authorityKind ?? null,
          recipientName: input.recipientName.trim(),
          channel: input.channel,
          incidentId: input.incidentId ?? null,
          findingId: input.findingId ?? null,
          deviceInstanceId: input.deviceInstanceId ?? null,
          siteId: input.siteId ?? null,
          subject: input.subject.trim(),
          bodyText: input.bodyText?.trim() || null,
          dueAt,
          sentAt,
          sentByUserId: actor.userId,
          sentByName: actor.name,
          reference: input.reference?.trim() || null,
          recordedByUserId: actor.userId,
          recordedByName: actor.name,
        },
      });

      for (const doc of docs) {
        let blobId: string | null = null;
        const dataUrl = doc.dataUrl?.trim();
        if (dataUrl) {
          const meta = blobMetaFromDataUrl(dataUrl);
          const blob = await tx.attachmentBlob.create({
            data: {
              tenantId: ctx.tenantId,
              kind: "notification_document",
              dataUrl,
              contentType: meta.contentType,
              byteSize: meta.byteSize,
            },
          });
          blobId = blob.id;
        }
        await tx.notificationDocument.create({
          data: {
            tenantId: ctx.tenantId,
            notificationId: created.id,
            role: doc.role,
            blobId,
            externalRef: doc.externalRef?.trim() || null,
            addedByUserId: actor.userId,
            addedByName: actor.name,
          },
        });
      }

      if (input.kind === "incident" && input.incidentId) {
        await tx.deviceIncident.update({
          where: { id: input.incidentId },
          data: {
            reportedAt: sentAt,
            reportedTo: input.recipientName.trim(),
            reportReference: input.reference?.trim() || null,
          },
        });
      }

      return created;
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "AuthorityNotification",
      resourceId: row.id,
      action: "send",
      summary: `Notification (${row.kind}) to ${row.recipientName}`,
      after: {
        kind: row.kind,
        incidentId: row.incidentId,
        findingId: row.findingId,
        deviceInstanceId: row.deviceInstanceId,
        siteId: row.siteId,
        state: row.state,
      },
    });

    return mapRow(row);
  },

  /**
   * Record that a named person sent an incident authority report.
   * Does not transmit — state starts at `sent` when sentAt is provided.
   */
  async recordIncidentReport(
    ctx: TenantContext,
    input: {
      incidentId: string;
      recipientName: string;
      channel?: NotificationChannel;
      subject: string;
      bodyText?: string | null;
      sentAt: string;
      reference?: string | null;
      authorityKind?: "device_authority" | "health_office" | "other" | null;
    },
  ): Promise<AuthorityNotificationDTO> {
    return this.record(ctx, {
      kind: "incident",
      incidentId: input.incidentId,
      recipientName: input.recipientName,
      channel: input.channel ?? "authority_portal",
      subject: input.subject,
      bodyText: input.bodyText,
      sentAt: input.sentAt,
      reference: input.reference,
      authorityKind: input.authorityKind ?? "device_authority",
    });
  },

  /** Record Abhilfenachweis notification for a finding (does not transmit). */
  async recordFindingRemediation(
    ctx: TenantContext,
    input: {
      findingId: string;
      recipientName: string;
      channel?: NotificationChannel;
      subject: string;
      bodyText?: string | null;
      sentAt: string;
      reference?: string | null;
    },
  ): Promise<AuthorityNotificationDTO> {
    return this.record(ctx, {
      kind: "finding_remediation",
      findingId: input.findingId,
      recipientName: input.recipientName,
      channel: input.channel ?? "email",
      subject: input.subject,
      bodyText: input.bodyText,
      sentAt: input.sentAt,
      reference: input.reference,
      authorityKind: "device_authority",
    });
  },

  async acknowledge(
    ctx: TenantContext,
    id: string,
    input: { acknowledgedAt: string; reference?: string | null },
  ): Promise<AuthorityNotificationDTO> {
    requirePermission(ctx, "authority:view");
    const existing = await prisma.authorityNotification.findFirst({ where: { id } });
    if (!existing) throw notFound("Notification not found");
    if (existing.state !== "sent" && existing.state !== "draft") {
      throw badRequest("Only draft/sent notifications can be acknowledged");
    }
    const row = await prisma.authorityNotification.update({
      where: { id },
      data: {
        state: "acknowledged",
        acknowledgedAt: new Date(`${input.acknowledgedAt}T00:00:00.000Z`),
        reference: input.reference ?? existing.reference,
      },
    });
    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "AuthorityNotification",
      resourceId: id,
      action: "acknowledge",
      summary: "Notification acknowledged",
    });
    return mapRow(row);
  },
};
