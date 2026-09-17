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

- Project documentation in `docs/PROJECT.md`
- Changelog workflow (`CHANGELOG.md`)
- MySQL as the primary database provider (replacing local SQLite for app runtime)

### Changed

- Prisma `provider` set to `mysql`; Vitest uses MySQL via `DATABASE_URL` / `TEST_DATABASE_URL`

### Fixed

-

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
