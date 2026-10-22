/**
 * Best-effort backfill: map frozen name → User.id when the name is unique.
 * Ambiguous or missing names stay null (UI still shows the name column).
 */

export type NameUserCandidate = { id: string; name: string; tenantId: string | null };

/** Build name → userId only when exactly one user has that trimmed name (optionally scoped by tenant). */
export function uniqueNameToUserId(
  users: readonly NameUserCandidate[],
  opts: { tenantId?: string | null } = {},
): Map<string, string> {
  const counts = new Map<string, string[]>();
  for (const u of users) {
    if (opts.tenantId != null && u.tenantId != null && u.tenantId !== opts.tenantId) continue;
    const key = u.name.trim();
    if (!key) continue;
    const list = counts.get(key) ?? [];
    list.push(u.id);
    counts.set(key, list);
  }
  const out = new Map<string, string>();
  for (const [name, ids] of counts) {
    if (ids.length === 1) out.set(name, ids[0]!);
  }
  return out;
}

export function resolveUserIdForName(
  name: string,
  uniqueByName: Map<string, string>,
): string | null {
  return uniqueByName.get(name.trim()) ?? null;
}
