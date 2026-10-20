import type { AuthorityNotificationDTO, TenantContext } from "@/interfaces";
import { actorAttribution } from "@/lib/auth/attribution";
import { requirePermission } from "@/lib/auth/tenantContext";
import { actorFromTenant } from "@/lib/auth/actorContext";
import { badRequest, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import type {
  NotificationChannel,
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

function assertExactlyOneSubject(args: {
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
    requirePermission(ctx, "incidents:manage");
    const incident = await prisma.deviceIncident.findFirst({ where: { id: input.incidentId } });
    if (!incident) throw notFound("Incident not found");
    assertExactlyOneSubject({ incidentId: input.incidentId });

    const actor = actorAttribution(ctx);
    const sentAt = new Date(`${input.sentAt}T00:00:00.000Z`);
    const row = await prisma.authorityNotification.create({
      data: {
        tenantId: ctx.tenantId,
        kind: "incident",
        state: "sent",
        authorityKind: input.authorityKind ?? "device_authority",
        recipientName: input.recipientName,
        channel: input.channel ?? "authority_portal",
        incidentId: input.incidentId,
        subject: input.subject,
        bodyText: input.bodyText ?? null,
        sentAt,
        sentByUserId: actor.userId,
        sentByName: actor.name,
        reference: input.reference ?? null,
        recordedByUserId: actor.userId,
        recordedByName: actor.name,
      },
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "AuthorityNotification",
      resourceId: row.id,
      action: "send",
      summary: `Incident notification to ${row.recipientName}`,
      after: { incidentId: input.incidentId, state: row.state },
    });

    return mapRow(row);
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
    requirePermission(ctx, "authority:view");
    const finding = await prisma.authorityFinding.findFirst({ where: { id: input.findingId } });
    if (!finding) throw notFound("Finding not found");
    assertExactlyOneSubject({ findingId: input.findingId });

    const actor = actorAttribution(ctx);
    const row = await prisma.authorityNotification.create({
      data: {
        tenantId: ctx.tenantId,
        kind: "finding_remediation",
        state: "sent",
        authorityKind: "device_authority",
        recipientName: input.recipientName,
        channel: input.channel ?? "email",
        findingId: input.findingId,
        subject: input.subject,
        bodyText: input.bodyText ?? null,
        sentAt: new Date(`${input.sentAt}T00:00:00.000Z`),
        sentByUserId: actor.userId,
        sentByName: actor.name,
        reference: input.reference ?? null,
        recordedByUserId: actor.userId,
        recordedByName: actor.name,
      },
    });

    await recordAudit({
      actor: actorFromTenant(ctx),
      resource: "AuthorityNotification",
      resourceId: row.id,
      action: "send",
      summary: `Finding remediation to ${row.recipientName}`,
      after: { findingId: input.findingId, state: row.state },
    });

    return mapRow(row);
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
