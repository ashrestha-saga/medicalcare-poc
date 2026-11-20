/**
 * Scan path — clinic DGUV own check (R33), constancy-style.
 */
import type {
  ScanDguvOpenDTO,
  ScanDguvResultDTO,
  TenantWorkContext,
} from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { isRadiationDguvEnabled } from "@/lib/features/radiationDguv";
import { prisma } from "@/lib/prisma";
import { assertDeviceInWorkAreas } from "@/services/users/userAreaScope";
import { dguvOwnCheckService } from "@/services/duties/dguvOwnCheckService";
import type { DguvShortCompleteInput } from "@/schemas/radiationDguv";

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

async function flagOn(tenantId: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featureFlags: true },
  });
  return isRadiationDguvEnabled(tenant?.featureFlags);
}

/** Due/overdue DGUV own_check duties on the device. */
export async function deviceHasOpenDguvOwnCheck(deviceId: string): Promise<boolean> {
  const today = startOfTodayUtc();
  const duty = await prisma.deviceDuty.findFirst({
    where: {
      deviceInstanceId: deviceId,
      dutyKey: "dguv",
      applicable: true,
      suspendedAt: null,
      determinationState: "own_check",
      dueAt: { lte: today },
    },
    select: { id: true },
  });
  return Boolean(duty);
}

export async function deviceHasDguvOwnCheckDuty(deviceId: string): Promise<boolean> {
  const duty = await prisma.deviceDuty.findFirst({
    where: {
      deviceInstanceId: deviceId,
      dutyKey: "dguv",
      applicable: true,
      suspendedAt: null,
      determinationState: "own_check",
    },
    select: { id: true },
  });
  return Boolean(duty);
}

/** Device ids in set that have open DGUV own_check. */
export async function openDguvOwnCheckDeviceIds(
  tenantId: string,
  deviceIds: string[],
): Promise<Set<string>> {
  if (!(await flagOn(tenantId)) || deviceIds.length === 0) return new Set();
  const today = startOfTodayUtc();
  const rows = await prisma.deviceDuty.findMany({
    where: {
      tenantId,
      deviceInstanceId: { in: deviceIds },
      dutyKey: "dguv",
      applicable: true,
      suspendedAt: null,
      determinationState: "own_check",
      dueAt: { lte: today },
    },
    select: { deviceInstanceId: true },
  });
  return new Set(rows.map((r) => r.deviceInstanceId));
}

type LimitOpts = {
  limitOhm?: number;
  limitMohmByClass?: Record<string, number>;
  limitMa?: number;
};

function limitForClass(
  opts: LimitOpts | null,
  protectionClass: string | null,
): number | null {
  if (!opts) return null;
  if (typeof opts.limitOhm === "number") return opts.limitOhm;
  if (typeof opts.limitMa === "number") return opts.limitMa;
  if (opts.limitMohmByClass && protectionClass) {
    const v = opts.limitMohmByClass[protectionClass];
    return typeof v === "number" ? v : null;
  }
  return null;
}

async function measurementTemplates(protectionClass: string | null) {
  const cat = await prisma.refInspectionCatalogue.findFirst({
    where: { code: "K-DGUV" },
    include: {
      steps: {
        where: { inputKind: "measurement" },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!cat) {
    return [
      { name: "Schutzleiterwiderstand", unit: "Ω", limit: 0.3, limitText: "≤ 0,3 Ω (SK I)" },
      { name: "Isolationswiderstand", unit: "MΩ", limit: 1, limitText: "≥ 1 MΩ" },
      { name: "Berührungsstrom", unit: "mA", limit: 0.5, limitText: "Referenz" },
    ];
  }
  return cat.steps.map((s) => {
    let opts: LimitOpts | null = null;
    if (s.optionsJson && typeof s.optionsJson === "object" && !Array.isArray(s.optionsJson)) {
      opts = s.optionsJson as LimitOpts;
    }
    const classes = (opts as { protectionClasses?: string[] } | null)?.protectionClasses;
    if (
      classes?.length &&
      protectionClass &&
      !classes.includes(protectionClass)
    ) {
      return null;
    }
    return {
      name: s.label,
      unit: s.unit ?? "",
      limit: limitForClass(opts, protectionClass),
      limitText: s.limitText,
    };
  }).filter((x): x is NonNullable<typeof x> => x != null);
}

export const scanDguvService = {
  async listOpen(ctx: TenantWorkContext, deviceId: string): Promise<ScanDguvOpenDTO> {
    requirePermission(ctx, "inventory:view");
    if (!(await flagOn(ctx.tenantId))) {
      throw unprocessable("radiation_dguv not enabled");
    }

    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceId },
      select: {
        id: true,
        inventoryNumber: true,
        areaId: true,
        kind: true,
        protectionClass: true,
        characteristicsJson: true,
        model: { select: { tradeName: true, modelName: true } },
      },
    });
    if (!device) throw notFound("Device not found");
    await assertDeviceInWorkAreas(ctx, device.areaId);

    const duty = await prisma.deviceDuty.findFirst({
      where: {
        deviceInstanceId: deviceId,
        dutyKey: "dguv",
        applicable: true,
        suspendedAt: null,
        determinationState: "own_check",
      },
      orderBy: { referenceDate: "desc" },
    });
    if (!duty) {
      throw unprocessable("No DGUV own_check duty on this device");
    }

    const today = startOfTodayUtc();
    let status: ScanDguvOpenDTO["status"] = "ok";
    if (duty.dueAt && duty.dueAt < today) status = "overdue";
    else if (duty.dueAt && isoDate(duty.dueAt) === isoDate(today)) status = "due";
    else if (duty.dueAt == null) status = "due";

    const label =
      device.model?.tradeName?.trim() ||
      device.model?.modelName?.trim() ||
      (() => {
        try {
          const j = device.characteristicsJson
            ? JSON.parse(device.characteristicsJson)
            : null;
          return typeof j?.tradeName === "string" ? j.tradeName : device.inventoryNumber;
        } catch {
          return device.inventoryNumber;
        }
      })();

    const completed = await prisma.dutyPerformance.findFirst({
      where: {
        tenantId: ctx.tenantId,
        deviceDutyId: duty.id,
        performedAt: today,
        source: "manual",
      },
      orderBy: { performedAt: "desc" },
    });

    const measurements = await measurementTemplates(device.protectionClass);

    return {
      deviceId: device.id,
      inventoryNumber: device.inventoryNumber,
      label,
      protectionClass: device.protectionClass,
      dutyId: duty.id,
      title: duty.title ?? "DGUV V3",
      dueAt: isoDate(duty.dueAt),
      status,
      intervalMonths: duty.intervalValue,
      gbuRef: duty.basisText,
      performedAt: isoDate(today)!,
      measurements,
      completedToday: completed
        ? {
            result: completed.result === "failed" ? "failed" : "passed",
            labelNumber: completed.labelNumber,
            performedBy: completed.performedBy,
            performedAt: completed.performedAt.toISOString(),
            nextDueAt: isoDate(duty.dueAt),
          }
        : null,
    };
  },

  async submit(
    ctx: TenantWorkContext,
    deviceId: string,
    input: {
      dutyId: string;
      result: "passed" | "failed";
      performedBy?: string | null;
      labelNumber?: string | null;
      measurements: DguvShortCompleteInput["measurements"];
      note?: string | null;
      performedAt?: string | null;
    },
  ): Promise<ScanDguvResultDTO> {
    requirePermission(ctx, "inventory:view");
    const open = await this.listOpen(ctx, deviceId);
    if (open.dutyId !== input.dutyId) {
      throw unprocessable("Duty mismatch", { field: "dutyId" });
    }
    if (open.completedToday) {
      throw unprocessable("Already completed today");
    }

    const performedBy = input.performedBy?.trim() || ctx.user.name;
    const performedAt = input.performedAt ?? open.performedAt;

    const result = await dguvOwnCheckService.complete(ctx, input.dutyId, {
      kind: "dguv_short",
      performedBy,
      performedAt,
      result: input.result,
      labelNumber: input.labelNumber ?? null,
      measurements: input.measurements,
      note: input.note ?? null,
    });

    return {
      deviceId,
      inventoryNumber: open.inventoryNumber,
      dutyId: input.dutyId,
      result: input.result,
      labelNumber: result.labelNumber,
      labelNextDue: result.labelNextDue,
      dueAt: result.dueAt,
      performedAt,
    };
  },
};
