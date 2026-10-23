import type {
  ScanDeviceCardDTO,
  ScanFurtherActionDTO,
  ScanPrimaryActionDTO,
  TenantContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { assertDeviceInWorkAreas } from "@/services/users/userAreaScope";
import {
  consequenceMeansOutOfService,
  resolveFurtherActions,
  resolvePrimaryAction,
  type SperrLageCode,
  type SperrQuelle,
} from "./scanPrimaryAction";
import {
  deriveKonstanzSperr,
  deviceHasOpenKonstanz,
} from "./scanKonstanzService";
import { isReprocessingEquipmentDevice } from "@/services/registration/reprocessingLinkService";
import { openDailyRefCodesForDevice } from "./scanRoutineService";

async function deviceHasOpenDailyChecks(device: {
  id: string;
  productKindCode: string | null;
  characteristicsJson: string | null;
  area: { siteId: string | null } | null;
}): Promise<boolean> {
  if (!isReprocessingEquipmentDevice(device)) return false;
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const [dailyRefs, doneToday] = await Promise.all([
    prisma.refReprocessingCheck.findMany({
      where: { cadence: "daily" },
      select: { code: true, scope: true, equipmentTypeCode: true },
    }),
    prisma.reprocessingCheck.findMany({
      where: {
        performedAt: todayUtc,
        OR: [
          { equipmentDeviceId: device.id },
          ...(device.area?.siteId ? [{ siteId: device.area.siteId }] : []),
        ],
      },
      select: { checkCode: true, equipmentDeviceId: true, siteId: true },
    }),
  ]);
  return (
    openDailyRefCodesForDevice(
      {
        id: device.id,
        productKindCode: device.productKindCode,
        characteristicsJson: device.characteristicsJson,
        siteId: device.area?.siteId ?? null,
      },
      dailyRefs,
      doneToday,
    ).length > 0
  );
}

async function deriveSperrLage(deviceId: string): Promise<{
  lage: SperrLageCode;
  quelle: SperrQuelle;
  grund: string | null;
}> {
  const book = await prisma.deviceBookEntry.findMany({
    where: { deviceInstanceId: deviceId },
    orderBy: [{ occurredAt: "desc" }, { recordedAt: "desc" }],
    take: 20,
    select: {
      occurredAt: true,
      description: true,
      consequence: true,
      incidentId: true,
      incident: { select: { closedAt: true } },
    },
  });

  for (const b of book) {
    if (!consequenceMeansOutOfService(b.consequence)) continue;
    if (b.incidentId && b.incident && !b.incident.closedAt) {
      const d = b.occurredAt.toISOString().slice(0, 10);
      return {
        lage: "stop",
        quelle: "stoerung",
        grund: `Außer Betrieb seit ${d}: ${b.description}`,
      };
    }
    if (consequenceMeansOutOfService(b.consequence)) {
      const d = b.occurredAt.toISOString().slice(0, 10);
      return {
        lage: "stop",
        quelle: "stoerung",
        grund: `Außer Betrieb seit ${d}: ${b.description}`,
      };
    }
  }

  const failedCheck = await prisma.reprocessingCheck.findFirst({
    where: {
      equipmentDeviceId: deviceId,
      OR: [{ passed: false }, { withinLimit: false }],
    },
    orderBy: { performedAt: "desc" },
    select: { performedAt: true, note: true, checkCode: true },
  });
  if (failedCheck) {
    const laterOk = await prisma.reprocessingCheck.findFirst({
      where: {
        equipmentDeviceId: deviceId,
        checkCode: failedCheck.checkCode,
        performedAt: { gt: failedCheck.performedAt },
        passed: true,
      },
      select: { id: true },
    });
    if (!laterOk) {
      const d = failedCheck.performedAt.toISOString().slice(0, 10);
      return {
        lage: "stop",
        quelle: "routine",
        grund: `Routinekontrolle am ${d} nicht bestanden${failedCheck.note ? `: ${failedCheck.note}` : ""}`,
      };
    }
  }

  const konstanz = await deriveKonstanzSperr(deviceId);
  if (konstanz) return konstanz;

  // Affected + measure not recorded → hard stop (do not use on patients).
  // Closing the FSCA does not clear this — only actionTakenAt does.
  const openFsn = await prisma.fieldSafetyDeviceAction.findFirst({
    where: {
      deviceInstanceId: deviceId,
      affected: true,
      actionTakenAt: null,
    },
    include: { fieldSafetyAction: { select: { reference: true, requiredAction: true } } },
  });
  if (openFsn) {
    return {
      lage: "stop",
      quelle: "rueckruf",
      grund: `Nicht anwenden — Rückruf ${openFsn.fieldSafetyAction.reference}: ${openFsn.fieldSafetyAction.requiredAction}`,
    };
  }

  return { lage: "ok", quelle: null, grund: null };
}

function toPrimaryDto(a: ReturnType<typeof resolvePrimaryAction>): ScanPrimaryActionDTO {
  return {
    ctx: a.ctx,
    titleKey: a.titleKey,
    textKey: a.textKey,
    tone: a.tone,
    servicePrefill: a.servicePrefill,
    infoOnly: a.infoOnly,
    batchId: a.batchId,
  };
}

function toFurtherDto(list: ReturnType<typeof resolveFurtherActions>): ScanFurtherActionDTO[] {
  return list.map((a) => ({
    ctx: a.ctx,
    titleKey: a.titleKey,
    textKey: a.textKey,
    batchId: a.batchId,
    ref: a.ref,
  }));
}

export const scanDeviceCardService = {
  async get(ctx: TenantContext, deviceId: string): Promise<ScanDeviceCardDTO> {
    requirePermission(ctx, "inventory:view");
    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceId },
      include: {
        model: { select: { id: true, tradeName: true, modelName: true, manufacturer: true } },
        area: { select: { name: true, siteId: true, site: { select: { name: true } } } },
      },
    });
    if (!device) throw notFound("Device not found");
    await assertDeviceInWorkAreas(ctx, device.areaId);

    const isEquipment = isReprocessingEquipmentDevice(device);

    const [sperr, openBatchRows, openDailyChecks, openKonstanzChecks, konstanzDuty, openReq, ifuEv, modelIfu] =
      await Promise.all([
        deriveSperrLage(deviceId),
        prisma.reprocessingBatch.findMany({
          where: { equipmentDeviceId: deviceId, releaseResult: null },
          orderBy: { startedAt: "desc" },
          select: { id: true },
          take: 20,
        }),
        deviceHasOpenDailyChecks(device),
        deviceHasOpenKonstanz(deviceId),
        prisma.deviceDuty.findFirst({
          where: {
            deviceInstanceId: deviceId,
            dutyKey: "konstanz",
            applicable: true,
            suspendedAt: null,
          },
          select: { id: true },
        }),
        prisma.serviceRequest.findFirst({
          where: {
            subjectType: "instance",
            subjectId: deviceId,
            state: { notIn: ["completed", "rejected"] },
          },
          orderBy: { createdAt: "desc" },
          select: { reference: true },
        }),
        prisma.deviceEvidence.findFirst({
          where: {
            deviceInstanceId: deviceId,
            prerequisiteCode: { in: ["ga", "ifu", "gebrauchsanweisung"] },
          },
          select: {
            externalRecordRef: true,
            prerequisiteCode: true,
            attachmentBlobId: true,
          },
        }),
        device.modelId
          ? prisma.modelDocument.findFirst({
              where: { deviceModelId: device.modelId, kind: "ifu", supersededAt: null },
              orderBy: { validFrom: "desc" },
              select: {
                revisionLabel: true,
                blobId: true,
                externalUrl: true,
              },
            })
          : Promise.resolve(null),
      ]);
    const openBatches = openBatchRows.length;
    const latestOpenBatchId = openBatchRows[0]?.id;
    const ifuOpenUrl =
      (modelIfu?.blobId ? `/api/attachments/${modelIfu.blobId}` : null) ||
      modelIfu?.externalUrl?.trim() ||
      (ifuEv?.attachmentBlobId ? `/api/attachments/${ifuEv.attachmentBlobId}` : null) ||
      ifuEv?.externalRecordRef?.trim() ||
      null;
    const ifuLabel =
      modelIfu?.revisionLabel?.trim() ||
      ifuEv?.externalRecordRef?.trim() ||
      (modelIfu || ifuEv ? "§ 4 MPBetreibV" : null);

    const permissions = (ctx.permissions ?? []) as readonly PermissionSlug[];
    const role = (ctx.user.role ?? null) as UserRole | null;
    const actionInput = {
      state: device.state as ScanDeviceCardDTO["state"],
      isEquipment,
      openBatchCount: openBatches,
      openDailyChecks,
      openKonstanzChecks,
      hasKonstanzDuties: Boolean(konstanzDuty),
      ifuLabel,
      ifuOpenUrl,
      lage: sperr.lage,
      quelle: sperr.quelle,
      grund: sperr.grund,
      openRequestRef: openReq?.reference ?? null,
      permissions,
      role,
    };
    const primary = resolvePrimaryAction(actionInput);
    if (primary.ctx === "charge" && latestOpenBatchId) {
      primary.batchId = latestOpenBatchId;
    }
    const further = resolveFurtherActions(actionInput, primary).map((a) =>
      a.ctx === "charge" && latestOpenBatchId ? { ...a, batchId: latestOpenBatchId } : a,
    );

    const label =
      device.model?.tradeName?.trim() ||
      device.model?.modelName?.trim() ||
      device.model?.manufacturer?.trim() ||
      device.inventoryNumber;

    return {
      deviceId: device.id,
      inventoryNumber: device.inventoryNumber,
      serialNumber: device.serialNumber,
      label,
      manufacturer: device.model?.manufacturer ?? null,
      state: device.state as ScanDeviceCardDTO["state"],
      siteName: device.area?.site?.name ?? null,
      areaName: device.area?.name ?? null,
      room: device.room,
      sperrLage: sperr.lage,
      sperrQuelle: sperr.quelle,
      sperrGrund: sperr.grund,
      openBatchCount: openBatches,
      openDailyChecks,
      openKonstanzChecks,
      openRequestRef: openReq?.reference ?? null,
      ifuLabel,
      ifuOpenUrl,
      primary: toPrimaryDto(primary),
      further: toFurtherDto(further),
    };
  },
};
