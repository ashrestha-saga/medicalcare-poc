/**
 * E105 / R68–R69 — IFU function checks before use.
 */
import type { TenantWorkContext } from "@/interfaces";
import type {
  RefRoutineCheckDTO,
  RoutineCheckDTO,
  RoutineDueDeviceDTO,
} from "@/interfaces/routineChecks";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { conflict, forbidden, notFound, unprocessable } from "@/lib/errors";
import { isRoutineChecksEnabled } from "@/lib/features/addendum6";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit/auditService";
import type {
  CaptureRoutineCheckInput,
  CreateRoutineDefinitionInput,
} from "@/schemas/routineChecks";
import { createHash, randomBytes } from "node:crypto";

function requireFlag(ctx: TenantWorkContext) {
  // Read tenant flags via a lightweight query when needed by callers that already gated UI.
  return ctx;
}

async function assertFlag(tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { featureFlags: true },
  });
  if (!isRoutineChecksEnabled(tenant?.featureFlags)) {
    throw forbidden("Routine checks are not enabled for this tenant");
  }
}

function mapRef(r: {
  code: string;
  scope: string;
  deviceModelId: string | null;
  productKindCode: string | null;
  label: string;
  cadence: string;
  checkpointsJson: unknown;
  unit: string | null;
  limitText: string | null;
  basisText: string;
  confidence: string;
  tenantId: string | null;
  active: boolean;
}): RefRoutineCheckDTO {
  const checkpoints = Array.isArray(r.checkpointsJson)
    ? (r.checkpointsJson as Array<{ key: string; text: string }>)
    : [];
  return {
    code: r.code,
    scope: r.scope as "model" | "product_kind",
    deviceModelId: r.deviceModelId,
    productKindCode: r.productKindCode,
    label: r.label,
    cadence: r.cadence,
    checkpoints,
    unit: r.unit,
    limitText: r.limitText,
    basisText: r.basisText,
    confidence: r.confidence,
    tenantId: r.tenantId,
    isReference: r.tenantId == null,
    active: r.active,
  };
}

function mapCheck(r: {
  id: string;
  checkCode: string;
  deviceInstanceId: string;
  performedAt: Date;
  performedBy: string;
  passed: boolean | null;
  measuredValue: string | null;
  withinLimit: boolean | null;
  findingsJson: unknown;
  bookEntryId: string | null;
  serviceRequestId: string | null;
  check: { label: string };
}): RoutineCheckDTO {
  const findings = Array.isArray(r.findingsJson)
    ? (r.findingsJson as Array<{ key: string; finding: string }>)
    : [];
  return {
    id: r.id,
    checkCode: r.checkCode,
    label: r.check.label,
    deviceInstanceId: r.deviceInstanceId,
    performedAt: r.performedAt.toISOString(),
    performedBy: r.performedBy,
    passed: r.passed,
    measuredValue: r.measuredValue,
    withinLimit: r.withinLimit,
    findings,
    bookEntryId: r.bookEntryId,
    serviceRequestId: r.serviceRequestId,
  };
}

function windowStart(cadence: string, now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (cadence === "weekly") {
    const day = d.getUTCDay(); // 0 Sun
    const mondayOffset = day === 0 ? 6 : day - 1;
    d.setUTCDate(d.getUTCDate() - mondayOffset);
  }
  return d;
}

export const routineCheckService = {
  async listReferences(ctx: TenantWorkContext): Promise<RefRoutineCheckDTO[]> {
    requirePermission(ctx, "inventory:view");
    await assertFlag(ctx.tenantId);
    const rows = await prisma.refRoutineCheck.findMany({
      where: { tenantId: null, active: true },
      orderBy: { code: "asc" },
    });
    return rows.map(mapRef);
  },

  async listDefinitions(ctx: TenantWorkContext): Promise<RefRoutineCheckDTO[]> {
    requirePermission(ctx, "inventory:view");
    await assertFlag(ctx.tenantId);
    const rows = await prisma.refRoutineCheck.findMany({
      where: {
        active: true,
        OR: [{ tenantId: ctx.tenantId }, { tenantId: null }],
      },
      orderBy: [{ tenantId: "desc" }, { code: "asc" }],
    });
    // Tenant row supersedes reference for same model/product kind
    const byTarget = new Map<string, (typeof rows)[0]>();
    for (const r of rows) {
      const key =
        r.scope === "model"
          ? `model:${r.deviceModelId}`
          : `pk:${r.productKindCode}`;
      const existing = byTarget.get(key);
      if (!existing || (r.tenantId && !existing.tenantId)) {
        byTarget.set(key, r);
      }
    }
    return [...byTarget.values()].map(mapRef);
  },

  async createDefinition(
    ctx: TenantWorkContext,
    input: CreateRoutineDefinitionInput,
  ): Promise<RefRoutineCheckDTO> {
    requirePermission(ctx, "inventory:update");
    await assertFlag(ctx.tenantId);
    requireFlag(ctx);

    if (input.scope === "model" && !input.deviceModelId) {
      throw unprocessable("deviceModelId required for model scope");
    }
    if (input.scope === "product_kind" && !input.productKindCode) {
      throw unprocessable("productKindCode required for product_kind scope");
    }

    const code =
      input.code?.trim() ||
      `rc-${ctx.tenantId.slice(0, 6)}-${randomBytes(3).toString("hex")}`;

    const row = await prisma.refRoutineCheck.create({
      data: {
        code,
        ruleSetId: "rs-mpbetreibv",
        scope: input.scope,
        deviceModelId: input.deviceModelId ?? null,
        productKindCode: input.productKindCode ?? null,
        label: input.label,
        cadence: input.cadence,
        checkpointsJson: input.checkpoints ?? [],
        unit: input.unit ?? null,
        limitText: input.limitText ?? null,
        limitSource: input.limitText ? "operator" : null,
        basisText: input.basisText,
        confidence: "determination",
        determinedBy: ctx.user.name,
        determinedByUserId: ctx.user.id,
        determinedAt: new Date(),
        tenantId: ctx.tenantId,
        active: true,
      },
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "RefRoutineCheck",
      resourceId: row.code,
      action: "create",
      summary: `Routine definition ${row.code}`,
    });

    return mapRef(row);
  },

  async listForDevice(ctx: TenantWorkContext, deviceId: string): Promise<RoutineCheckDTO[]> {
    requirePermission(ctx, "inventory:view");
    await assertFlag(ctx.tenantId);
    const rows = await prisma.routineCheck.findMany({
      where: { deviceInstanceId: deviceId },
      include: { check: { select: { label: true } } },
      orderBy: { performedAt: "desc" },
      take: 20,
    });
    return rows.map(mapCheck);
  },

  async definitionsForDevice(ctx: TenantWorkContext, deviceId: string): Promise<RefRoutineCheckDTO[]> {
    requirePermission(ctx, "inventory:view");
    await assertFlag(ctx.tenantId);
    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceId },
      select: { modelId: true, productKindCode: true },
    });
    if (!device) throw notFound("Device");

    const all = await this.listDefinitions(ctx);
    return all.filter((d) => {
      if (d.scope === "model") return d.deviceModelId === device.modelId;
      return d.productKindCode && d.productKindCode === device.productKindCode;
    });
  },

  async capture(
    ctx: TenantWorkContext,
    deviceId: string,
    input: CaptureRoutineCheckInput,
  ): Promise<RoutineCheckDTO> {
    requirePermission(ctx, "inventory:view"); // clinic user+
    await assertFlag(ctx.tenantId);

    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceId },
      select: { id: true, inventoryNumber: true, modelId: true, productKindCode: true },
    });
    if (!device) throw notFound("Device");

    const def = await prisma.refRoutineCheck.findFirst({
      where: {
        code: input.checkCode,
        active: true,
        OR: [{ tenantId: ctx.tenantId }, { tenantId: null }],
      },
    });
    if (!def) throw notFound("Routine definition");

    if (input.idempotencyKey) {
      const existing = await prisma.routineCheck.findFirst({
        where: { idempotencyKey: input.idempotencyKey },
        include: { check: { select: { label: true } } },
      });
      if (existing) {
        if (existing.deviceInstanceId !== deviceId) {
          throw conflict("Idempotency key already used for another device");
        }
        return mapCheck(existing);
      }
    }

    const findings = input.findings ?? [];
    let passed = input.passed;
    let withinLimit: boolean | null = null;
    if (findings.length) passed = false;
    if (input.measuredValue != null && def.limitText) {
      const num = Number(String(input.measuredValue).replace(",", "."));
      const limitMatch = def.limitText.match(/(\d+(?:[.,]\d+)?)/);
      if (!Number.isNaN(num) && limitMatch) {
        const limit = Number(limitMatch[1]!.replace(",", "."));
        const ge = /≥|>=|min/i.test(def.limitText);
        withinLimit = ge ? num >= limit : num <= limit;
        if (withinLimit === false) passed = false;
      }
    }
    if (passed == null) {
      passed = findings.length === 0 && withinLimit !== false;
    }

    const result = await prisma.$transaction(async (tx) => {
      let bookEntryId: string | null = null;
      let serviceRequestId: string | null = null;

      if (passed === false) {
        const book = await tx.deviceBookEntry.create({
          data: {
            tenantId: ctx.tenantId,
            deviceInstanceId: deviceId,
            kind: "malfunction",
            occurredAt: new Date(),
            description:
              findings.map((f) => `${f.key}: ${f.finding}`).join("; ") ||
              "Funktionskontrolle nicht bestanden",
            recordedBy: ctx.user.name,
            recordedByUserId: ctx.user.id,
          },
        });
        bookEntryId = book.id;
        // Optional SR is prompted in UI (createRequest); keep capture non-blocking.
        void input.createRequest;
        serviceRequestId = null;
      }

      try {
        return await tx.routineCheck.create({
          data: {
            tenantId: ctx.tenantId,
            checkCode: def.code,
            deviceInstanceId: deviceId,
            performedAt: new Date(),
            performedBy: ctx.user.name,
            performedById: ctx.user.id,
            passed,
            measuredValue: input.measuredValue ?? null,
            withinLimit,
            findingsJson: findings,
            bookEntryId,
            serviceRequestId,
            idempotencyKey: input.idempotencyKey ?? null,
          },
          include: { check: { select: { label: true } } },
        });
      } catch (err) {
        if (input.idempotencyKey && String(err).includes("Unique")) {
          const again = await tx.routineCheck.findFirst({
            where: { idempotencyKey: input.idempotencyKey },
            include: { check: { select: { label: true } } },
          });
          if (again) return again;
        }
        throw err;
      }
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "RoutineCheck",
      resourceId: result.id,
      action: "create",
      summary: `Routine ${def.code} on ${device.inventoryNumber}: ${passed ? "passed" : "failed"}`,
    });

    return mapCheck(result);
  },

  async countOpenToday(ctx: TenantWorkContext): Promise<number> {
    await assertFlag(ctx.tenantId);
    const due = await this.listOpenToday(ctx);
    return due.length;
  },

  async listOpenToday(ctx: TenantWorkContext): Promise<RoutineDueDeviceDTO[]> {
    requirePermission(ctx, "inventory:view");
    await assertFlag(ctx.tenantId);

    const defs = (await this.listDefinitions(ctx)).filter(
      (d) => d.cadence === "daily" || d.cadence === "weekly",
    );
    if (!defs.length) return [];

    const devices = await prisma.deviceInstance.findMany({
      where: {
        state: "released",
        OR: [
          { modelId: { in: defs.filter((d) => d.deviceModelId).map((d) => d.deviceModelId!) } },
          {
            productKindCode: {
              in: defs.filter((d) => d.productKindCode).map((d) => d.productKindCode!),
            },
          },
        ],
      },
      select: {
        id: true,
        inventoryNumber: true,
        modelId: true,
        productKindCode: true,
        model: { select: { tradeName: true, modelName: true } },
      },
      take: 500,
    });

    const out: RoutineDueDeviceDTO[] = [];
    for (const device of devices) {
      const matching = defs.filter((d) =>
        d.scope === "model"
          ? d.deviceModelId === device.modelId
          : d.productKindCode === device.productKindCode,
      );
      for (const def of matching) {
        const since = windowStart(def.cadence);
        const done = await prisma.routineCheck.findFirst({
          where: {
            deviceInstanceId: device.id,
            checkCode: def.code,
            performedAt: { gte: since },
          },
          select: { id: true },
        });
        if (done) continue;
        out.push({
          deviceInstanceId: device.id,
          inventoryNumber: device.inventoryNumber,
          deviceName:
            device.model?.tradeName || device.model?.modelName || device.inventoryNumber,
          checkCode: def.code,
          checkLabel: def.label,
          cadence: def.cadence,
        });
      }
    }
    return out;
  },
};

/** Deterministic seed code helper (unused at runtime; for seeds). */
export function routineSeedCode(label: string): string {
  return `ref-rc-${createHash("sha1").update(label).digest("hex").slice(0, 10)}`;
}
