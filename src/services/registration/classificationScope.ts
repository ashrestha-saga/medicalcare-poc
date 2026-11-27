/**
 * E104 / R67 — DeviceModelClassification tenancy helpers.
 * Global rows (tenantId null, key `global:<modelId>`) are templates only.
 * Tenant writes always create/close `<tenantId>:<modelId>` rows.
 */
import type { Prisma } from "@prisma/client";

export function globalClassificationKey(deviceModelId: string): string {
  return `global:${deviceModelId}`;
}

export function tenantClassificationKey(tenantId: string, deviceModelId: string): string {
  return `${tenantId}:${deviceModelId}`;
}

export function isGlobalClassificationKey(key: string | null | undefined): boolean {
  return Boolean(key?.startsWith("global:"));
}

type Tx = Prisma.TransactionClient | typeof import("@/lib/prisma").prisma;

/** Open classification for a clinic: tenant row first, else global template. */
export async function getOpenClassification(
  db: Tx,
  deviceModelId: string,
  tenantId?: string | null,
) {
  if (tenantId) {
    const tenantRow = await db.deviceModelClassification.findFirst({
      where: {
        deviceModelId,
        tenantId,
        validTo: null,
        openClassificationKey: tenantClassificationKey(tenantId, deviceModelId),
      },
      orderBy: { validFrom: "desc" },
    });
    if (tenantRow) return tenantRow;
  }

  return db.deviceModelClassification.findFirst({
    where: {
      deviceModelId,
      tenantId: null,
      validTo: null,
      OR: [
        { openClassificationKey: globalClassificationKey(deviceModelId) },
        // Legacy rows before backfill may still use bare modelId
        { openClassificationKey: deviceModelId },
      ],
    },
    orderBy: { validFrom: "desc" },
  });
}

/** Close only the open tenant row (never a global template). */
export async function closeOpenTenantClassification(
  tx: Prisma.TransactionClient,
  args: { deviceModelId: string; tenantId: string; at?: Date },
) {
  const at = args.at ?? new Date();
  await tx.deviceModelClassification.updateMany({
    where: {
      deviceModelId: args.deviceModelId,
      tenantId: args.tenantId,
      validTo: null,
    },
    data: { validTo: at, openClassificationKey: null },
  });
}

/** Close only the open global template row (platform_operator). */
export async function closeOpenGlobalClassification(
  tx: Prisma.TransactionClient,
  args: { deviceModelId: string; at?: Date },
) {
  const at = args.at ?? new Date();
  await tx.deviceModelClassification.updateMany({
    where: {
      deviceModelId: args.deviceModelId,
      tenantId: null,
      validTo: null,
    },
    data: { validTo: at, openClassificationKey: null },
  });
}

export type ClassificationCreateInput = {
  deviceModelId: string;
  tenantId: string;
  ruleSetId: string;
  stk?: boolean;
  mtkItemId?: string | null;
  radiation?: boolean;
  softwareClass?: string | null;
  confidence?: "verified" | "responsible" | "determination" | "derived" | "not_applicable" | "guess";
  evidenceText?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: Date | null;
  productKindCode?: string | null;
  characteristics?: string | null;
  fieldStates?: string | null;
  decisions?: string | null;
  deferredFields?: string | null;
  appliedPartCode?: string | null;
  deviceFamilyCode?: string | null;
};

/**
 * Close previous tenant open row (if any), copy templateId from global when present,
 * and insert a new tenant open classification.
 */
export async function createTenantClassification(
  tx: Prisma.TransactionClient,
  input: ClassificationCreateInput,
) {
  await closeOpenTenantClassification(tx, {
    deviceModelId: input.deviceModelId,
    tenantId: input.tenantId,
  });

  const template = await tx.deviceModelClassification.findFirst({
    where: {
      deviceModelId: input.deviceModelId,
      tenantId: null,
      validTo: null,
    },
    orderBy: { validFrom: "desc" },
  });

  return tx.deviceModelClassification.create({
    data: {
      deviceModelId: input.deviceModelId,
      tenantId: input.tenantId,
      templateId: template?.id ?? null,
      openClassificationKey: tenantClassificationKey(input.tenantId, input.deviceModelId),
      stk: input.stk ?? false,
      mtkItemId: input.mtkItemId ?? null,
      radiation: input.radiation ?? false,
      softwareClass: input.softwareClass ?? null,
      confidence: input.confidence ?? "derived",
      evidenceText: input.evidenceText ?? null,
      ruleSetId: input.ruleSetId,
      confirmedBy: input.confirmedBy ?? null,
      confirmedAt: input.confirmedAt ?? null,
      productKindCode: input.productKindCode ?? null,
      characteristics: input.characteristics ?? null,
      fieldStates: input.fieldStates ?? null,
      decisions: input.decisions ?? null,
      deferredFields: input.deferredFields ?? null,
      appliedPartCode: input.appliedPartCode ?? null,
      deviceFamilyCode: input.deviceFamilyCode ?? null,
    },
  });
}
