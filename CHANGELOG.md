# Changelog

All notable changes to **DeviceCare** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) (`MAJOR.MINOR.PATCH`).

## How to update (before every push)

1. Add bullets under **`[Unreleased]`** while you work (or right before push).
2. Use these categories only when needed:
   - **Added** — new features
   - **Changed** — changes in existing behavior
   - **Deprecated** — soon-to-be removed
   - **Removed** — removed features
   - **Fixed** — bug fixes
   - **Security** — vulnerability fixes
3. When you cut a release (or after a meaningful push), move `[Unreleased]` items into a dated version section, for example:

   ```md
   ## [0.2.0] — 2026-09-17

   ### Added
   - …
   ```

4. Bump `version` in `package.json` when you create a new version section.
5. Commit `CHANGELOG.md` together with the code you are pushing.

Keep entries short, user-facing, and in the past tense (“Added X”, “Fixed Y”). Prefer one line per change.

---

## [Unreleased]

### Added

- Erstanlage (initial registration) wizard: identity → characteristics → duties → prerequisites; duties preview and release APIs under `/api/registration/*`
- Admin model reclassification at `/registration/reclassify/[modelId]` (third-party / document evidence on apply)
- `POST /api/registration/preview` (derive duties without a draft) and payload `POST /api/registration/release`
- Dual-language UI (EN / DE) via next-intl, cookie locale, status-bar and Settings language toggle
- Training module (`/training`, `training:view`): events overview, person×model matrix, record session API
- Management page (`/management`): partner organisation contracts and people with access for the clinic
- Partner portal (`/partner`, `/login/partner`): organisation home, people, disposition, my-sites, due-dates, inspection orders, test equipment settings
- Service-request executor allocation and transmit flow (`/api/service-requests/.../allocate|transmit`)
- Clinic withdraw assignment before transmit (`POST /api/service-requests/[reference]/withdraw` + AlertDialog UX)
- Prüfpartner inspect portal (`/(inspect)/inspect`): catalogue resolution, qualification / equipment / baseline gates, protocol steps, seal
- Inspection schema: `RefInspectionCatalogue` / steps, `InspectionRun` / `InspectionStepResult`, `BaselineMeasurement`, `TestEquipment`, device families / applied parts
- Seeded Prüfpartner catalogues (`seed-pruefpartner.json`) and demo instruments (MSR Sicherheitstester + MSR/RTS Röntgen-Prüfkörper)
- Appearance setting (System / Light / Dark) with clinical light theme tokens and browser persistence
- Reference master data (`RefProductKind`, `RefInspectionType`, `RefAnnex2Item`, …) seeded from stammdaten
- Historised `DeviceModelClassification`, release snapshots, and frozen `DeviceDuty` rows
- Per-duty due dates on release/reclassify (`DeviceDuty.dueAt`) with inventory duties list and mark-done
- Due dates board (`/due-dates`, `duties:view`) with assignment from a duty (navigates to `/requests/[reference]`)
- `POST /api/duties/[id]/complete`, `GET /api/devices/[id]/duties`, `GET /api/duties`
- DB-backed role permission grants (`RoleGrant`) with editable Roles admin UI (`roles:update`)
- Clarifications list for incomplete inventory data (superadmin / device admin)
- Responsible person as device-admin user dropdown (modular `/api/users/options`)
- Maintenance cycle on models/instances with next due date, completion roll-forward, and audit events
- Inventory barcode labels (CODE128 of inventory number + name/serial) with single and bulk print
- Project documentation in `docs/PROJECT.md` / `docs/SCHEMA_AND_ARCHITECTURE.md` (Prüfpartner sync)
- Changelog workflow (`CHANGELOG.md`)
- MySQL as the primary database provider (replacing local SQLite for app runtime)

### Changed

- Scan service-type selection is **manual** only (classification proposal engine removed)
- Clarifications and inventory detail read open `DeviceModelClassification` instead of proposals
- Released device identity/classification fields are immutable via PATCH
- Role permissions resolve from the database (seeded from `ROLE_PERMISSIONS`); `/roles` is no longer read-only
- Prisma `provider` set to `mysql`; Vitest uses MySQL via `DATABASE_URL` / `TEST_DATABASE_URL`
- Erstanlage wizard no longer saves a draft on Continue; the device is written on Release (`POST /api/registration/release`). Inventarize drafts still resume at `/registration/[id]`.
- Locale switch swaps message catalogs in place (no full page reload), so wizard form state is preserved
- New modules (training, management, partner, inspect) follow page → feature → hooks → interface → service → schema layering
- Partner assignment lists (disposition, my-sites, inspection orders) require `transmittedAt` (clinic transmit handoff)
- Inspection step UX: row layout with pass/fail (EN) / In Ordnung·Mangel (DE) and measured value under the title

### Removed

- `Classification` / `ClassificationRule` / `ClassificationProposal` models and `classificationService` proposal flow

### Fixed

- Locale toggle no longer wiped in-progress Erstanlage form state

### Security

-

---

## [0.1.0] — 2026-09-17

Initial POC baseline.

### Added

- Mobile-first scan → resolve → classify → service request / spare-parts flow
- Four-stage resolution: inventory → catalog → BEUDAMED → manual capture
- Classification suggestions (verified / derived / guess) with confirmation rules
- Idempotent service requests and multi-target dispatch (mail / OXID / webhook)
- Offline queue (IndexedDB) with idempotent replay
- Inventory and catalog management (incl. inventarize after catalog/BEUDAMED requests)
- Auto inventarnummer allocation (`INV-#####`) with mandatory serial on inventarize
- Email dispatch includes inventarnummer and serial for inventory subjects
- Email/password auth, optional device PIN lock, TOTP 2FA (`/security`)
- Static RBAC roles (`superadmin`, `device_admin`, `security_officer`, `user`)
- OXID shop link (OAuth2 + PKCE) and adapter modes for OXID / BEUDAMED
- Prisma + SQLite local persistence (MySQL-ready schema)
- Vitest unit/integration tests and Playwright e2e harness

[Unreleased]: #unreleased
[0.1.0]: #010--2026-09-17
