import type {
  Area,
  CapturedArticle,
  Classification,
  ClassificationRule,
  DeviceInstance,
  DeviceModel,
  DispatchRecord,
  DispatchTarget,
  OrderItem,
  OrderRequest,
  ServiceRequest,
  Site,
  StatusEvent,
} from "@prisma/client";
import type {
  CapturedArticleDTO,
  ClassificationRuleDTO,
  ClassificationSubmissionDTO,
  DeviceInstanceDTO,
  DeviceModelDTO,
  DispatchTargetDTO,
  OrderRequestDTO,
  ServiceRequestDTO,
  SiteDTO,
} from "@/interfaces";
import { inspectionTagsFromFlags } from "@/lib/inspectionTags";
import { parseJson } from "@/lib/json";
import { deriveMaintenanceStatus } from "@/lib/maintenance/schedule";

export { inspectionTagsFromFlags };

/** Prisma rows → DTOs. Raw external shapes never pass through here (Section 8). */

export function toDeviceModelDTO(
  row: DeviceModel & { maintenanceCycleMonths?: number | null },
): DeviceModelDTO {
  return {
    id: row.id,
    basicUdiDi: row.basicUdiDi,
    udiDi: row.udiDi,
    gtins: parseJson<string[]>(row.gtins, []),
    manufacturer: row.manufacturer,
    manufacturerSrn: row.manufacturerSrn,
    tradeName: row.tradeName,
    modelName: row.modelName,
    riskClass: row.riskClass,
    emdnCode: row.emdnCode,
    gmdnCode: row.gmdnCode,
    source: row.source as DeviceModelDTO["source"],
    sourceFetchedAt: row.sourceFetchedAt?.toISOString() ?? null,
    version: row.version,
    state: row.state as DeviceModelDTO["state"],
    maintenanceCycleMonths: row.maintenanceCycleMonths ?? null,
  };
}

/** Instance row + includes. Extra scalars declared so editors stay valid if Prisma Client lags generate. */
export type DeviceInstanceWithRelations = DeviceInstance & {
  model: (DeviceModel & { maintenanceCycleMonths?: number | null }) | null;
  area: (Area & { site: Site }) | null;
  classification: Classification | null;
  responsibleUser?: { id: string; name: string; email?: string | null } | null;
  responsibleUserId?: string | null;
  maintenanceCycleMonths?: number | null;
  maintenanceAnchorAt?: Date | null;
  lastMaintainedAt?: Date | null;
  nextMaintenanceDueAt?: Date | null;
};

export function toDeviceInstanceDTO(row: DeviceInstanceWithRelations): DeviceInstanceDTO {
  const site = row.area?.site ?? null;
  const parts = [site?.name, row.area?.name, row.room].filter(Boolean);
  const responsibleName = row.responsibleUser?.name ?? row.responsiblePerson;
  return {
    id: row.id,
    inventoryNumber: row.inventoryNumber,
    serialNumber: row.serialNumber,
    manufacturer: row.model?.manufacturer ?? null,
    modelName: row.model?.modelName ?? null,
    tradeName: row.model?.tradeName ?? null,
    modelId: row.modelId,
    location: row.area
      ? {
          siteId: site?.id ?? null,
          siteName: site?.name ?? null,
          areaId: row.area.id,
          areaName: row.area.name,
          room: row.room,
          text: parts.join(", "),
        }
      : null,
    commissionedAt: row.commissionedAt?.toISOString() ?? null,
    responsiblePerson: responsibleName,
    responsibleUserId: row.responsibleUserId ?? row.responsibleUser?.id ?? null,
    maintenanceCycleMonths: row.maintenanceCycleMonths ?? null,
    maintenanceAnchorAt: row.maintenanceAnchorAt?.toISOString() ?? null,
    lastMaintainedAt: row.lastMaintainedAt?.toISOString() ?? null,
    nextMaintenanceDueAt: row.nextMaintenanceDueAt?.toISOString() ?? null,
    maintenanceStatus: deriveMaintenanceStatus(row.nextMaintenanceDueAt),
    classification: row.classification
      ? {
          annex1: row.classification.annex1,
          annex2: row.classification.annex2,
          softwareClass: row.classification.softwareClass,
          radiation: row.classification.radiation,
          confirmedBy: row.classification.confirmedBy,
          confirmedAt: row.classification.confirmedAt?.toISOString() ?? null,
        }
      : null,
    inspectionTags: inspectionTagsFromFlags(row.classification),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCapturedArticleDTO(row: CapturedArticle): CapturedArticleDTO {
  return {
    id: row.id,
    name: row.name,
    manufacturer: row.manufacturer,
    number: row.number,
    numberType: row.numberType as CapturedArticleDTO["numberType"],
    nameplateAttachmentId: row.nameplateAttachmentId,
    capturedBy: row.capturedBy,
    capturedAt: row.capturedAt.toISOString(),
    // DAT-302a — the DTO type itself forbids anything but `true`.
    serviceOnly: true,
  };
}

export function toClassificationRuleDTO(row: ClassificationRule): ClassificationRuleDTO {
  return {
    id: row.id,
    matchType: row.matchType as ClassificationRuleDTO["matchType"],
    matchValue: row.matchValue,
    annex1: row.annex1,
    annex2: row.annex2,
    softwareClass: row.softwareClass as ClassificationRuleDTO["softwareClass"],
    radiation: row.radiation,
    confidence: row.confidence as ClassificationRuleDTO["confidence"],
    source: row.source,
    validFrom: row.validFrom?.toISOString() ?? null,
    validTo: row.validTo?.toISOString() ?? null,
  };
}

export type ServiceRequestWithRelations = ServiceRequest & {
  statusEvents: StatusEvent[];
  dispatchRecords: DispatchRecord[];
  _count?: { attachments: number };
};

function dispatchRecordDetail(response: string | null, error: string | null): string | null {
  if (error?.trim()) return error.trim();
  if (!response) return null;
  try {
    const r = JSON.parse(response) as Record<string, unknown>;
    if (r.simulated === true) {
      const to = typeof r.to === "string" ? r.to : null;
      const reason = typeof r.reason === "string" ? r.reason : null;
      if (reason === "smtp_disabled") {
        return to ? `SMTP deaktiviert (Test) → ${to}` : "SMTP deaktiviert";
      }
      return to ? `Simuliert (kein SMTP) → ${to}` : "Simuliert — kein SMTP-Versand";
    }
    if (r.simulated === false && typeof r.to === "string") {
      const id = typeof r.messageId === "string" ? r.messageId : null;
      const photos =
        typeof r.attachmentCount === "number" && r.attachmentCount > 0
          ? ` · ${r.attachmentCount} Foto${r.attachmentCount === 1 ? "" : "s"}`
          : "";
      return id ? `Gesendet → ${r.to} · ${id}${photos}` : `Gesendet → ${r.to}${photos}`;
    }
    if (r.simulated === false && typeof r.messageId === "string") {
      return `Gesendet · ${r.messageId}`;
    }
    if (r.mock === true) return "Mock akzeptiert";
    if (typeof r.subject === "string") return r.subject;
    if (typeof r.externalReference === "string") return r.externalReference;
    if (r.body && typeof r.body === "object" && r.reason === undefined) return "Payload vorbereitet";
  } catch {
    return null;
  }
  return null;
}

export function toServiceRequestDTO(row: ServiceRequestWithRelations): ServiceRequestDTO {
  return {
    id: row.id,
    reference: row.reference,
    idempotencyKey: row.idempotencyKey,
    subjectType: row.subjectType as ServiceRequestDTO["subjectType"],
    subjectId: row.subjectId,
    serviceType: row.serviceType,
    priority: row.priority,
    note: row.note,
    raisedBy: row.raisedBy,
    siteId: row.siteId,
    locationText: row.locationText,
    accessHint: row.accessHint,
    contact: row.contact,
    deliveryAddress: row.deliveryAddress,
    classification: parseJson<ClassificationSubmissionDTO | null>(row.classification, null),
    state: row.state,
    createdAt: row.createdAt.toISOString(),
    statusEvents: [...row.statusEvents]
      .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime())
      .map((e) => ({
        state: e.state,
        changedAt: e.changedAt.toISOString(),
        source: e.source,
        actor: e.actor,
        note: e.note,
      })),
    dispatchRecords: row.dispatchRecords.map((d) => ({
      target: d.target,
      timestamp: d.timestamp.toISOString(),
      success: d.success,
      httpStatus: d.httpStatus,
      error: d.error,
      attemptCount: d.attemptCount,
      detail: dispatchRecordDetail(d.response, d.error),
    })),
    attachmentCount: row._count?.attachments ?? 0,
  };
}

export function toDispatchTargetDTO(row: DispatchTarget): DispatchTargetDTO {
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.type,
    name: row.name,
    endpoint: row.endpoint,
    auth: parseJson<Record<string, unknown> | null>(row.auth, null),
    mapping: parseJson<Record<string, unknown> | null>(row.mapping, null),
    enabled: row.enabled,
    retryPolicy: parseJson<DispatchTargetDTO["retryPolicy"]>(row.retryPolicy, null),
  };
}

export function toOrderRequestDTO(row: OrderRequest & { items: OrderItem[] }): OrderRequestDTO {
  return {
    id: row.id,
    reference: row.reference,
    idempotencyKey: row.idempotencyKey,
    subjectType: row.subjectType as OrderRequestDTO["subjectType"],
    subjectId: row.subjectId,
    deliveryAddress: row.deliveryAddress,
    note: row.note,
    approvalState: row.approvalState,
    state: row.state,
    raisedBy: row.raisedBy,
    createdAt: row.createdAt.toISOString(),
    items: row.items.map((i) => ({
      id: i.id,
      articleId: i.articleId,
      articleNumber: i.articleNumber,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  };
}

export function toSiteDTO(row: {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  deliveryAddress: string | null;
  areas: { id: string; name: string; _count?: { instances: number } }[];
}): SiteDTO {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address,
    deliveryAddress: row.deliveryAddress,
    areas: row.areas.map((a) => ({ id: a.id, name: a.name })),
    deviceCount: row.areas.reduce((sum, a) => sum + (a._count?.instances ?? 0), 0),
  };
}
