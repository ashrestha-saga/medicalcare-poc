import type { PartnerContext } from "@/interfaces/session";
import { forbidden } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { parseContractScope } from "@/constants/partnerPermissions";

export interface PartnerManageResult {
  contractId: string;
  scope: string[];
  organisationName: string;
  appRole: string;
}

function inDateWindow(from: Date, to: Date | null, now: Date): boolean {
  if (from.getTime() > now.getTime()) return false;
  if (to != null && to.getTime() <= now.getTime()) return false;
  return true;
}

export function isLiveContract(row: {
  validFrom: Date;
  validTo: Date | null;
  terminatedAt: Date | null;
  suspendedAt: Date | null;
}, now = new Date()): boolean {
  if (row.terminatedAt != null || row.suspendedAt != null) return false;
  return inDateWindow(row.validFrom, row.validTo, now);
}

export function requirePartnerAdmin(ctx: PartnerContext): void {
  if (ctx.user.appRole !== "admin") throw forbidden();
}

export async function assertOrgHasServiceProvider(organisationId: string, now = new Date()): Promise<void> {
  const role = await prisma.organisationRole.findFirst({
    where: { organisationId, role: "service_provider" },
  });
  if (!role || !inDateWindow(role.grantedFrom, role.grantedTo, now)) throw forbidden();
}

/** Membership + service_provider + live contract — partner may open this tenant. */
export async function assertPartnerManagesTenant(
  userId: string,
  organisationId: string,
  tenantId: string,
  now = new Date(),
): Promise<PartnerManageResult> {
  // Explicit org/tenant filters — bypass ALS so this can run before bindTenant / from tests.
  return runWithoutTenantAsync(async () => {
    const [membership, providerRole, organisation, contract] = await Promise.all([
      prisma.orgMembership.findFirst({
        where: { userId, organisationId },
      }),
      prisma.organisationRole.findFirst({
        where: { organisationId, role: "service_provider" },
      }),
      prisma.organisation.findFirst({ where: { id: organisationId }, select: { id: true, name: true } }),
      prisma.serviceContract.findFirst({
        where: { organisationId, tenantId },
      }),
    ]);

    if (!organisation) throw forbidden();
    if (!membership || !inDateWindow(membership.validFrom, membership.validTo, now)) throw forbidden();
    if (!providerRole || !inDateWindow(providerRole.grantedFrom, providerRole.grantedTo, now)) {
      throw forbidden();
    }
    if (!contract || !isLiveContract(contract, now)) throw forbidden();

    // Non-admin: must have an explicit PartnerStaffAssignment for this tenant (fail closed).
    if (membership.appRole !== "admin") {
      const assignment = await prisma.partnerStaffAssignment.findFirst({
        where: { membershipId: membership.id, tenantId },
      });
      if (!assignment) throw forbidden();
    }

    return {
      contractId: contract.id,
      scope: parseContractScope(contract.scope),
      organisationName: organisation.name,
      appRole: membership.appRole,
    };
  });
}
