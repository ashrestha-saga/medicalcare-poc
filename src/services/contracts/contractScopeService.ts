import type { PermissionSlug } from "@/interfaces/permissions";
import {
  normalizeContractScope,
  parseContractScope,
  SCOPE_PERMISSIONS,
  type ContractScopeToken,
} from "@/constants/partnerPermissions";
import { PARTNER_FORBIDDEN_PERMISSIONS } from "@/constants/partnerPermissions";
import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

const FORBIDDEN = new Set<string>(PARTNER_FORBIDDEN_PERMISSIONS);

/** Expand coarse contract tokens to permission slugs (never includes PARTNER_FORBIDDEN). */
export function expandScopeTokensToSlugs(tokens: readonly string[]): PermissionSlug[] {
  const normalized = normalizeContractScope([...tokens]);
  const out = new Set<PermissionSlug>();
  for (const token of normalized) {
    for (const slug of SCOPE_PERMISSIONS[token as ContractScopeToken]) {
      if (!FORBIDDEN.has(slug)) out.add(slug);
    }
  }
  return [...out];
}

export type ScopeGrantRow = { permission: string; denied: boolean };

/**
 * Dual-read: prefer catalogue grant rows when any exist; else expand legacy JSON tokens.
 * Denied rows (“nie”) are subtracted after expansion.
 */
export function resolveContractScopeSlugs(
  scopeJson: string,
  grantRows: readonly ScopeGrantRow[],
): PermissionSlug[] {
  const denied = new Set(
    grantRows.filter((r) => r.denied).map((r) => r.permission),
  );
  const positive = grantRows.filter((r) => !r.denied).map((r) => r.permission);

  let base: PermissionSlug[];
  if (grantRows.length > 0) {
    base = positive.filter((p): p is PermissionSlug => !FORBIDDEN.has(p)) as PermissionSlug[];
  } else {
    base = expandScopeTokensToSlugs(parseContractScope(scopeJson));
  }

  return base.filter((slug) => !denied.has(slug) && !FORBIDDEN.has(slug));
}

/** Replace auto token-sourced grants; preserve manual/nie rows. */
export async function syncContractScopeGrantsFromTokens(
  tx: Tx,
  contractId: string,
  tokens: readonly string[],
): Promise<{ written: number; preservedDenied: number }> {
  const slugs = expandScopeTokensToSlugs(tokens);
  await tx.serviceContractScopeGrant.deleteMany({
    where: { contractId, source: "token", denied: false },
  });
  const preservedDenied = await tx.serviceContractScopeGrant.count({
    where: { contractId, denied: true },
  });
  if (slugs.length === 0) return { written: 0, preservedDenied };

  await tx.serviceContractScopeGrant.createMany({
    data: slugs.map((permission) => ({
      contractId,
      permission,
      denied: false,
      source: "token",
    })),
    skipDuplicates: true,
  });
  return { written: slugs.length, preservedDenied };
}

/** Set or clear a “nie” deny for one slug (manual override). */
export async function setContractScopeDenied(
  tx: Tx,
  contractId: string,
  permission: PermissionSlug,
  denied: boolean,
): Promise<void> {
  if (denied) {
    await tx.serviceContractScopeGrant.upsert({
      where: { contractId_permission: { contractId, permission } },
      create: { contractId, permission, denied: true, source: "manual" },
      update: { denied: true, source: "manual" },
    });
  } else {
    await tx.serviceContractScopeGrant.deleteMany({
      where: { contractId, permission, denied: true },
    });
  }
}

/** Dry-run / migrate report: contracts missing grant rows. */
export async function reportContractsNeedingScopeBackfill(
  client: PrismaClient,
): Promise<{ contractId: string; tokens: string[]; wouldWrite: number }[]> {
  const contracts = await client.serviceContract.findMany({
    select: {
      id: true,
      scope: true,
      scopeGrants: { select: { id: true }, take: 1 },
    },
  });
  const out: { contractId: string; tokens: string[]; wouldWrite: number }[] = [];
  for (const c of contracts) {
    if (c.scopeGrants.length > 0) continue;
    const tokens = normalizeContractScope(parseContractScope(c.scope));
    out.push({
      contractId: c.id,
      tokens,
      wouldWrite: expandScopeTokensToSlugs(tokens).length,
    });
  }
  return out;
}

export async function backfillAllContractScopeGrants(
  client: PrismaClient,
): Promise<{ contracts: number; grants: number }> {
  const contracts = await client.serviceContract.findMany({
    select: { id: true, scope: true },
  });
  let grants = 0;
  for (const c of contracts) {
    const tokens = normalizeContractScope(parseContractScope(c.scope));
    const result = await syncContractScopeGrantsFromTokens(client, c.id, tokens);
    grants += result.written;
  }
  return { contracts: contracts.length, grants };
}
