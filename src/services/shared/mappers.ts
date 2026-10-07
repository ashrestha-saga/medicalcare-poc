import type {
  Area,
  DeviceInstance,
  DeviceModel,
  DeviceModelClassification,
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
  ClassificationSubmissionDTO,
  DeviceInstanceDTO,
  DeviceModelDTO,
  DispatchTargetDTO,
  OrderRequestDTO,
  ServiceRequestDTO,
  SiteDTO,
} from "@/interfaces";
import type { CapturedArticle } from "@prisma/client";
import { inspectionTagsFromFlags } from "@/lib/inspectionTags";
import { parseJson } from "@/lib/json";
import { deriveMaintenanceStatus } from "@/lib/maintenance/schedule";

export { inspectionTagsFromFlags };

/** Prisma rows → DTOs. Raw external shapes never pass through here (Section 8). */

export function toDeviceModelDTO(
  row: DeviceModel & {
    maintenanceCycleMonths?: number | null;
    classifications?: DeviceModelClassification[];
  },
): DeviceModelDTO {
  const openCls =
    row.classifications?.find((c) => c.validTo == null) ?? row.classifications?.[0] ?? null;
  const flags = classificationFlagsFromModel(openCls);
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
    classification: flags
      ? {
          annex1: flags.annex1,
          annex2: flags.annex2,
          softwareClass: flags.softwareClass,
          radiation: flags.radiation,
        }
      : null,
  };
}

export function classificationFlagsFromModel(
  c: DeviceModelClassification | null | undefined,
): {
  annex1: boolean | null;
  annex2: boolean | null;
  softwareClass: string | null;
  radiation: boolean | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
} | null {
  if (!c) return null;
  const annex2Asserted = Boolean(c.evidenceText?.includes("annex2-asserted"));
  return {
    annex1: c.stk,
    annex2: c.mtkItemId != null || annex2Asserted,
    softwareClass: c.softwareClass,
    radiation: c.radiation,
    confirmedBy: c.confirmedBy,
    confirmedAt: c.confirmedAt?.toISOString() ?? null,
  };
}

/** Instance row + includes. */
export type DeviceInstanceWithRelations = DeviceInstance & {
  model:
    | (DeviceModel & {
        maintenanceCycleMonths?: number | null;
        classifications?: DeviceModelClassification[];
      })
    | null;
  area: (Area & { site: Site }) | null;
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
  const openCls = row.model?.classifications?.find((c) => c.validTo == null) ?? row.model?.classifications?.[0] ?? null;
  const classification = classificationFlagsFromModel(openCls);
  const modelStateRaw = row.model?.state;
  const modelState =
    modelStateRaw === "draft" || modelStateRaw === "review" || modelStateRaw === "released"
      ? modelStateRaw
      : null;
  const instanceState =
    row.state === "review" || row.state === "released" || row.state === "retired"
      ? row.state
      : "draft";
  return {
    id: row.id,
    inventoryNumber: row.inventoryNumber,
    serialNumber: row.serialNumber,
    manufacturer: row.model?.manufacturer ?? null,
    modelName: row.model?.modelName ?? null,
    tradeName: row.model?.tradeName ?? null,
    modelId: row.modelId,
    state: instanceState,
    modelState,
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
    classification,
    inspectionTags: inspectionTagsFromFlags(classification),
    catalogPending: Boolean(modelState && modelState !== "released"),
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
    serviceOnly: true,
  };
}

export type ServiceRequestWithRelations = ServiceRequest & {
  statusEvents: StatusEvent[];
  dispatchRecords: DispatchRecord[];
  _count?: { attachments: number };
  executorOrg?: {
    id: string;
    code: string;
    name: string;
    kind: string;
    active: boolean;
  } | null;
  duty?: {
    id: string;
    title: string | null;
    dutyKey: string;
    basisText: string;
    dueAt: Date | null;
    inspectionTypeCode: string;
  } | null;
  subjectInstance?: {
    inventoryNumber: string;
    model: {
      tradeName: string | null;
      modelName: string | null;
      udiDi?: string | null;
    } | null;
  } | null;
  subjectModel?: {
    tradeName: string | null;
    modelName: string | null;
    udiDi: string | null;
    manufacturer: string | null;
  } | null;
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
        return to ? `SMTP disabled (test) → ${to}` : "SMTP disabled";
      }
      return to ? `Simulated (no SMTP) → ${to}` : "Simulated — no SMTP send";
    }
    if (r.simulated === false && typeof r.to === "string") {
      const id = typeof r.messageId === "string" ? r.messageId : null;
      const photos =
        typeof r.attachmentCount === "number" && r.attachmentCount > 0
          ? ` · ${r.attachmentCount} photo${r.attachmentCount === 1 ? "" : "s"}`
          : "";
      return id ? `Sent → ${r.to} · ${id}${photos}` : `Sent → ${r.to}${photos}`;
    }
    if (r.simulated === false && typeof r.messageId === "string") {
      return `Sent · ${r.messageId}`;
    }
    if (r.mock === true) return "Mock accepted";
    if (typeof r.subject === "string") return r.subject;
    if (typeof r.externalReference === "string") return r.externalReference;
    if (r.body && typeof r.body === "object" && r.reason === undefined) return "Payload prepared";
  } catch {
    return null;
  }
  return null;
}

export function toServiceRequestDTO(row: ServiceRequestWithRelations): ServiceRequestDTO {
  const instanceModel = row.subjectInstance?.model;
  const deviceName =
    instanceModel?.tradeName?.trim() ||
    instanceModel?.modelName?.trim() ||
    row.subjectInstance?.inventoryNumber ||
    row.subjectModel?.tradeName?.trim() ||
    row.subjectModel?.modelName?.trim() ||
    row.subjectModel?.udiDi?.trim() ||
    null;
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
    source: row.source ?? "app",
    dutyId: row.dutyId ?? null,
    executorOrgId: row.executorOrgId ?? null,
    executorOrg: row.executorOrg
      ? {
          id: row.executorOrg.id,
          code: row.executorOrg.code,
          name: row.executorOrg.name,
          kind: row.executorOrg.kind,
          active: row.executorOrg.active,
        }
      : null,
    allocatedAt: row.allocatedAt?.toISOString() ?? null,
    allocatedBy: row.allocatedBy ?? null,
    transmittedAt: row.transmittedAt?.toISOString() ?? null,
    allocationLocked: Boolean(row.transmittedAt),
    deviceName,
    inventoryNumber: row.subjectInstance?.inventoryNumber ?? null,
    duty: row.duty
      ? {
          id: row.duty.id,
          title: row.duty.title ?? row.duty.dutyKey,
          basisText: row.duty.basisText,
          dueAt: row.duty.dueAt?.toISOString() ?? null,
          inspectionTypeCode: row.duty.inspectionTypeCode,
        }
      : null,
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
