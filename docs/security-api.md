# API auth & tenant isolation (SEC-01)

## Context doors

| Door | Helper | Use for |
|------|--------|---------|
| Clinic | `requireTenantContext` | Clinic users only |
| Partner console | `requirePartnerContext` | Partner org APIs (`/api/partner/*`) |
| Shared clinic data | `requireActingContext` | Clinic **or** partner acting via `X-Acting-Tenant-Id` |
| Public / jobs | `readSession` / cron secret | Login, health, invite redeem, cron |

Always wrap Prisma work in `withTenantStore(ctx, …)` after resolving context (not `enterWith`).

## Permissions

Call `requirePermission(ctx, "…")` (or partner equivalents) on every mutating/read API that maps to a screen capability. UI checks are not enough.

### UserPermission snapshot rule

Clinic effective permissions:

1. **Zero** `UserPermission` rows for the user → fall back to `RoleGrant` (`kind=clinic`) for `User.role`.
2. **Any** `UserPermission` rows → those slugs are the **full** effective set (not a delta on the role).

Admins editing a user: sending an explicit list writes snapshot rows; clearing to empty / equal-to-role-preset removes rows so the user tracks the role again. Invites may carry an optional permissions JSON that becomes snapshot rows on redeem.

### Freeze slug growth (K10+)

Prefer existing `*:view` / `*:manage` (or `*:update` / `*:release`) pairs. Do **not** add one permission per tile or screen unless the capability is truly independent.

| Area | View | Mutate / admin |
|------|------|----------------|
| Incidents | `incidents:view` | `incidents:manage` |
| Field safety | `fieldsafety:view` | `fieldsafety:create` (record, match, suggest, close) |
| Device book | `devicebook:view` | — |
| Reprocessing | `reprocessing:view` | `reprocessing:release` |
| Authority | `authority:view` | record notifications (finding/device/site); incident kind needs `incidents:manage` |
| Duties / constancy / overlap | `duties:view` | — |
| Dashboard | (tile assignment uses existing inventory/duties grants) | — |

Constancy cadence and duty-overlap reuse `duties:view`. New screens should map to a row above before inventing a slug.

### Partner forbidden list

`PARTNER_FORBIDDEN_PERMISSIONS` in `src/constants/partnerPermissions.ts` strips clinic-admin and clinic-only slugs from acting capabilities (users/roles/settings/training, catalog writes, incidents manage, reprocessing release, authority).

When adding a **clinic-admin** API, add its slug to that list in the same change.

## Tenant Prisma guard

Models with a required `tenantId` must appear in `TENANT_SCOPED_MODELS` (`src/lib/prisma/tenantExtension.ts`), unless listed in `TENANT_GUARD_EXCLUSIONS` with a documented reason.

Drift is enforced by `src/lib/prisma/tenantGuardDrift.test.ts`.

## Checklist for new routes

1. Pick the correct context helper (table above).
2. `withTenantStore` around DB access.
3. `requirePermission` matching the module (reuse frozen pairs).
4. If adding a Prisma model with `tenantId: String` (required), add it to `TENANT_SCOPED_MODELS` in the same PR.
5. Partner-only console paths: update `partnerPermissions` forbidden list if the capability is clinic-admin.
