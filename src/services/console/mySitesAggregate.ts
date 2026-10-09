import type {
  MySitesInspectionDTO,
  MySitesInstitutionDTO,
  MySitesStaffAssignmentDTO,
  MySitesTenantShellDTO,
} from "@/interfaces/console";

/** Build institution rows; responsibility filters on clinic staff assignments. */
export function aggregateMySitesInstitutions(
  tenants: MySitesTenantShellDTO[],
  staffAssignments: MySitesStaffAssignmentDTO[],
  inspections: MySitesInspectionDTO[],
  responsibility: string,
  sessionUserId: string,
): MySitesInstitutionDTO[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const staffByTenant = new Map<string, MySitesStaffAssignmentDTO[]>();
  for (const a of staffAssignments) {
    const list = staffByTenant.get(a.tenantId) ?? [];
    list.push(a);
    staffByTenant.set(a.tenantId, list);
  }

  const inspectionsByTenant = new Map<string, MySitesInspectionDTO[]>();
  for (const i of inspections) {
    const list = inspectionsByTenant.get(i.tenantId) ?? [];
    list.push(i);
    inspectionsByTenant.set(i.tenantId, list);
  }

  const matchesResponsibility = (tenantId: string): boolean => {
    if (responsibility === "all") return true;
    const targetUserId = responsibility === "self" ? sessionUserId : responsibility;
    const staff = staffByTenant.get(tenantId) ?? [];
    return staff.some((s) => s.userId === targetUserId);
  };

  const institutions: MySitesInstitutionDTO[] = [];
  for (const shell of tenants) {
    if (!matchesResponsibility(shell.tenantId)) continue;

    const orders = inspectionsByTenant.get(shell.tenantId) ?? [];
    const dates = orders
      .map((o) => o.scheduledAt)
      .filter((d): d is string => Boolean(d))
      .sort();
    const overdueCount = orders.filter((o) => {
      if (!o.scheduledAt) return false;
      const when = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(o.scheduledAt) ? `${o.scheduledAt}T00:00:00` : o.scheduledAt,
      );
      return when < today;
    }).length;

    const staff = staffByTenant.get(shell.tenantId) ?? [];
    const assigneeMap = new Map<string, string>();
    for (const s of staff) {
      assigneeMap.set(s.userId, s.name);
    }

    institutions.push({
      ...shell,
      inspectionCount: orders.length,
      overdueCount,
      nextDue: dates[0] ?? null,
      assignees: [...assigneeMap.entries()]
        .map(([userId, name]) => ({ userId, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return institutions.sort((a, b) => {
    if (a.nextDue && b.nextDue) return a.nextDue.localeCompare(b.nextDue);
    if (a.nextDue) return -1;
    if (b.nextDue) return 1;
    return a.tenantName.localeCompare(b.tenantName);
  });
}
