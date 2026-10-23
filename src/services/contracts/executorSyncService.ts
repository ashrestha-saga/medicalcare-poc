import type { ExecutorOrg, Prisma, PrismaClient } from "@prisma/client";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { prisma } from "@/lib/prisma";
import { isLiveContract } from "@/services/access/partnerAccessService";

type Tx = Prisma.TransactionClient | PrismaClient;

export const INTERNAL_EXECUTOR_CODE = "O-INT";
export const INTERNAL_EXECUTOR_NAME = "Eigene Medizintechnik";

/** Stable clinic executor code for a partner organisation (O-MSR, O-RTS, …). */
export function executorCodeForOrg(orgCode: string): string {
  return `O-${orgCode}`;
}

/**
 * Ensure a default mail DispatchTarget for an executor so transmit / Settings toggles work.
 * Does not overwrite existing channels. Defaults to enabled.
 */
export async function ensureDefaultMailTarget(
  tx: Tx,
  opts: {
    tenantId: string;
    executorOrgId: string;
    executorName: string;
    /** Recipient address when known (e.g. organisation.contact). */
    endpoint?: string | null;
  },
): Promise<void> {
  const existing = await tx.dispatchTarget.findFirst({
    where: { tenantId: opts.tenantId, executorOrgId: opts.executorOrgId, type: "mail" },
    select: { id: true },
  });
  if (existing) return;

  const endpoint =
    opts.endpoint?.includes("@")
      ? opts.endpoint.trim()
      : `service@${opts.executorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "partner"}.example`;

  await tx.dispatchTarget.create({
    data: {
      tenantId: opts.tenantId,
      executorOrgId: opts.executorOrgId,
      type: "mail",
      name: `${opts.executorName} mailbox`,
      endpoint,
      enabled: true,
    },
  });
}

/** Ensure the in-house executor exists for a tenant. */
export async function ensureInternalExecutor(tx: Tx, tenantId: string): Promise<ExecutorOrg> {
  const row = await tx.executorOrg.upsert({
    where: { tenantId_code: { tenantId, code: INTERNAL_EXECUTOR_CODE } },
    update: {
      active: true,
      kind: "internal",
      name: INTERNAL_EXECUTOR_NAME,
      organisationId: null,
    },
    create: {
      tenantId,
      code: INTERNAL_EXECUTOR_CODE,
      name: INTERNAL_EXECUTOR_NAME,
      kind: "internal",
      active: true,
      sortOrder: 100,
      organisationId: null,
    },
  });
  await ensureDefaultMailTarget(tx, {
    tenantId,
    executorOrgId: row.id,
    executorName: INTERNAL_EXECUTOR_NAME,
    endpoint: "medizintechnik@clinic.example",
  });
  return row;
}

export type EnsureExecutorForContractInput = {
  tenantId: string;
  organisationId: string;
  orgCode?: string;
  orgName?: string;
  /** Defaults to true (live contract). */
  active?: boolean;
  sortOrder?: number;
};

/**
 * Upsert the clinic-local ExecutorOrg for a contracting partner organisation.
 * Prefer match by organisationId; fall back to O-{code} unique key.
 */
export async function ensureExecutorForContract(
  tx: Tx,
  input: EnsureExecutorForContractInput,
): Promise<ExecutorOrg> {
  let orgCode = input.orgCode;
  let orgName = input.orgName;
  if (!orgCode || !orgName) {
    const org = await tx.organisation.findUniqueOrThrow({
      where: { id: input.organisationId },
      select: { code: true, name: true },
    });
    orgCode = orgCode ?? org.code;
    orgName = orgName ?? org.name;
  }

  const code = executorCodeForOrg(orgCode);
  const active = input.active ?? true;
  const sortOrder = input.sortOrder ?? 10;

  const byOrg = await tx.executorOrg.findFirst({
    where: { tenantId: input.tenantId, organisationId: input.organisationId },
  });
  let row: ExecutorOrg;
  if (byOrg) {
    row = await tx.executorOrg.update({
      where: { id: byOrg.id },
      data: { active, name: orgName, code, kind: "external", sortOrder },
    });
  } else {
    row = await tx.executorOrg.upsert({
      where: { tenantId_code: { tenantId: input.tenantId, code } },
      update: {
        active,
        name: orgName,
        kind: "external",
        organisationId: input.organisationId,
        sortOrder,
      },
      create: {
        tenantId: input.tenantId,
        code,
        name: orgName,
        kind: "external",
        active,
        sortOrder,
        organisationId: input.organisationId,
      },
    });
  }

  const org = await tx.organisation.findUnique({
    where: { id: input.organisationId },
    select: { contact: true },
  });
  await ensureDefaultMailTarget(tx, {
    tenantId: input.tenantId,
    executorOrgId: row.id,
    executorName: orgName!,
    endpoint: org?.contact ?? null,
  });
  return row;
}

/** Flip active on the executor linked to a contract (suspend / terminate / resume). */
export async function setContractExecutorActive(
  tx: Tx,
  opts: { tenantId: string; organisationId: string; active: boolean },
): Promise<void> {
  const updated = await tx.executorOrg.updateMany({
    where: { tenantId: opts.tenantId, organisationId: opts.organisationId },
    data: { active: opts.active },
  });
  if (opts.active && updated.count === 0) {
    await ensureExecutorForContract(tx, {
      tenantId: opts.tenantId,
      organisationId: opts.organisationId,
      active: true,
    });
  }
}

/**
 * Whether an active executor may appear in the allocate list.
 * - Internal: always.
 * - External without organisationId: keep (legacy / manual).
 * - External with organisationId but no contract row: keep (e.g. inspection-only seed).
 * - External with a contract row: only while that contract is live.
 */
export function isExecutorAllocatable(
  row: { kind: string; code: string; organisationId: string | null },
  contractedOrgIds: Set<string>,
  liveOrgIds: Set<string>,
): boolean {
  if (row.kind === "internal" || row.code === INTERNAL_EXECUTOR_CODE) return true;
  if (!row.organisationId) return true;
  if (!contractedOrgIds.has(row.organisationId)) return true;
  return liveOrgIds.has(row.organisationId);
}

/** Load contract org sets for allocate filtering. */
export async function loadTenantContractOrgSets(
  tx: Tx,
  tenantId: string,
  now = new Date(),
): Promise<{ contractedOrgIds: Set<string>; liveOrgIds: Set<string> }> {
  const contracts = await tx.serviceContract.findMany({
    where: { tenantId },
    select: {
      organisationId: true,
      validFrom: true,
      validTo: true,
      suspendedAt: true,
      terminatedAt: true,
    },
  });
  const contractedOrgIds = new Set(contracts.map((c) => c.organisationId));
  const liveOrgIds = new Set(
    contracts.filter((c) => isLiveContract(c, now)).map((c) => c.organisationId),
  );
  return { contractedOrgIds, liveOrgIds };
}

/**
 * Backfill: every tenant gets O-INT; every live contract gets a linked executor;
 * suspended/terminated contracts deactivate their executor.
 */
export async function backfillExecutorsFromContracts(tx: Tx = prisma): Promise<{
  tenants: number;
  executorsUpserted: number;
}> {
  return runWithoutTenantAsync(async () => {
    const tenants = await tx.tenant.findMany({ select: { id: true } });
    let executorsUpserted = 0;
    for (const t of tenants) {
      await ensureInternalExecutor(tx, t.id);
      executorsUpserted += 1;
    }

    const contracts = await tx.serviceContract.findMany({
      include: { organisation: { select: { id: true, code: true, name: true } } },
    });
    for (const c of contracts) {
      const live = isLiveContract(c);
      await ensureExecutorForContract(tx, {
        tenantId: c.tenantId,
        organisationId: c.organisationId,
        orgCode: c.organisation.code,
        orgName: c.organisation.name,
        active: live,
      });
      executorsUpserted += 1;
    }

    return { tenants: tenants.length, executorsUpserted };
  });
}
