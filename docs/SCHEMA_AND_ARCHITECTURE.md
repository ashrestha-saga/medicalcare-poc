# DeviceCare — Schema & Architecture

Detailed reference for the Prisma/MySQL data model and how the application layers use it. For product behaviour, screens, and env setup see also [`PROJECT.md`](./PROJECT.md).

---

## Table of contents

1. [What the system is](#1-what-the-system-is)
2. [Architecture (layers)](#2-architecture-layers)
3. [Tenancy & identity](#3-tenancy--identity)
4. [Schema by domain](#4-schema-by-domain)
5. [Core workflows](#5-core-workflows)
6. [Client architecture](#6-client-architecture)
7. [Security (schema-related)](#7-security-schema-related)
8. [Entity relationship (simplified)](#8-entity-relationship-simplified)
9. [Adapter boundary](#9-adapter-boundary)
10. [Seeded clinic users](#10-seeded-clinic-users)

---

## 1. What the system is

**DeviceCare** is a multi-tenant, mobile-first Next.js app for clinic staff (and partner organisations) to:

1. Identify a medical device (camera scan or manual entry)
2. Resolve it through a four-stage chain
3. Open service requests or spare-parts orders
4. Run **Erstanlage** (initial registration) under MPBetreibV — freeze duties, due dates, and prerequisites
5. Manage inventory, catalog, training, audit, and dispatch to mail / OXID / webhooks

**Hard rule:** the browser never talks to Prisma. UI → BFF (`src/app/api/*`) → `src/services/*` → MySQL.

Source of truth for tables: `prisma/schema.prisma` (provider: **MySQL**, `DATABASE_URL`). Local development often reaches MySQL via an SSH tunnel on `127.0.0.1:3307`.

---

## 2. Architecture (layers)

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React 19 + Zustand + IndexedDB offline queue)     │
│  components/features/* · store/* · hooks                    │
└───────────────────────────┬─────────────────────────────────┘
                            │ fetch (apiClient)
┌───────────────────────────▼─────────────────────────────────┐
│  Next.js App Router BFF                                     │
│  app/(app) pages · app/(partner) · app/(auth)               │
│  app/api/* route handlers (auth, zod, permissions)          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Domain services (src/services/*)                           │
│  resolve · registration · inventory · requests · dispatch   │
│  auth · audit · training · partner · adapters/*             │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Prisma 6 → MySQL (DATABASE_URL)                            │
└─────────────────────────────────────────────────────────────┘
         ▲ external adapters (mock | stub | http)
         │ OXID catalog/parts · BEUDAMED · mail · webhook
```

### Directory roles

| Path | Role |
|---|---|
| `src/app/(app)` | Authenticated clinic UI routes |
| `src/app/(partner)` | Partner organisation portal |
| `src/app/(auth)` | Login, invite redeem (`/invite`), password reset (`/reset-password`) |
| `src/app/api/*` | Thin BFF: session, validate, call service, map errors |
| `src/services/*` | Business logic + Prisma |
| `src/interfaces/*` | Shared DTOs (client + server) |
| `src/schemas/*` | Zod request/body schemas |
| `src/constants/*` | Permissions, roles, routes |
| `src/lib/*` | Session, GS1, crypto, offline queue, http client |
| `src/store/*` | Client state machines (scan, session, offline, toast) |
| `prisma/` | Schema, migrations, seed |

### Runtime request path (typical)

```
UI hook (e.g. useResolve)
  → apiClient POST /api/resolve
    → requireTenantContext + permission check
      → resolveService.resolve(...)
        → Prisma (DeviceInstance / DeviceModel / ExternalSourceRecord)
          → optional adapter (OXID / BEUDAMED)
            → JSON DTO back to client
              → scanStore advances UI state
```

### Tech stack (summary)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Route Handlers as BFF) |
| UI | React 19, TypeScript, Tailwind v4, Radix |
| State | Zustand |
| Validation | zod |
| Persistence | Prisma 6 → MySQL |
| Offline | IndexedDB via `idb` |
| Scanning | `@zxing/browser` |
| 2FA | `otplib` + `qrcode` |

---

## 3. Tenancy & identity

```
Tenant (clinic) ── institutionOrgId? → Organisation (role=institution)
  ├── User (accountKind=clinic, role on User) ── UserPermission? (optional snapshot)
  ├── SmtpSettings? (clinic outbound mail)
  ├── Site → Area
  ├── DeviceInstance, ServiceRequest, DispatchTarget, …
  └── ServiceContract ←→ Organisation ← OrganisationRole
                              ├── OrgMembership.appRole ← User (partner)
                              └── SmtpSettings? (partner outbound mail)

OrganisationRole / OrganisationCapacity: institution | service_provider | inspection_partner | platform_operator
Partner User: tenantId=null, role=null, appRole on OrgMembership
Clinic User:  tenantId set, role = ClinicRole (superadmin | device_admin | security_officer | user)

RoleGrant.kind: clinic | partner_console | partner_acting  (isolates clinic /roles from partner matrices)
```

- Clinic tenant comes from the signed session cookie — never from the request body.
- Partner acting tenant comes only from the `x-acting-tenant-id` header and is re-checked every request (membership + `service_provider` + live contract).
- Clinic login door vs partner login door (`accountKind` on `User`).
- Clinic permissions: zero `UserPermission` rows ⇒ `RoleGrant` where `kind=clinic` for `User.role`; any rows ⇒ those rows are the full effective set. Partner console / acting: `RoleGrant` kinds `partner_console` / `partner_acting` (DB-backed; static catalogs as fallback), intersected with contract scope for acting.
- Shared APIs use `requireActingContext`. Reserved APIs (users, roles, training, settings, OXID, management) stay `requireTenantContext`.

---

## 4. Schema by domain

Each domain starts with a **quick-reference table**, then a longer write-up per model (purpose, key fields, where it runs). Canonical field list: `prisma/schema.prisma`.

**Key enums (Prisma):** `DeviceState`, `ServiceRequestState`, `OutboxState`, `ReminderStatus`, `PartnerAppRole`, `RoleGrantKind`, `TrainingMode`, `OperatingModel`, `OrganisationCapacity`, `ClinicRole`, `DutyPerformanceResult`, `OrderApprovalState`, `OrderRequestState`, `DutyKey`, `IntervalUnit`, `TermMatchConfidence`, plus Erstanlage enums `DutyCategory`, `DeadlineAnchor`, `Confidence`, `FieldState`, `EvidenceKind`.

### 4.1 Tenancy & locations

| Model | Purpose | Where it works |
|---|---|---|
| **Tenant** | Isolation boundary | Every clinic-scoped query; session; seed `demo-tenant` |
| **User** | Login identity; clinic role; TOTP; optional home area | Auth (`userAuthService`, TOTP), `/users`, inventarize “responsible”, training subject |
| **UserPermission** | Per-user clinic permission snapshot; empty ⇒ RoleGrant preset | Invite / edit user, `getEffectiveClinicPermissions`, capabilities |
| **UserInvitation** | Hashed invite token (clinic or partner); optional `permissions` JSON | `POST /api/users/invites`, `/api/partner/invites`, `/api/auth/invite/redeem` |
| **PasswordResetToken** | Hashed admin-triggered password reset link | `POST /api/users/[id]/reset-password`, `/api/auth/reset-password/redeem` |
| **TotpChallenge** | Short-lived 2FA challenge after password OK | `POST /api/auth/login` → `POST /api/auth/2fa/verify` |
| **TenantOxidConnection** | One OXID shop link per tenant (tokens server-side) | Settings OXID, `/auth/callback`, OXID adapters |
| **Site** / **Area** | Location hierarchy; site has structured address + display line | Locations UI, inventarize, service request location, console onboard, `User.homeArea` |
| **SiteHeadcount** | §6 headcount history | Registration prerequisites gate |
| **SafetyOfficerAppointment** | MPSB / safety officer appointments | Registration prerequisites / site compliance |

#### Tenant

**Purpose:** The clinic isolation boundary. Almost every operational row is scoped by `tenantId`. Optional `institutionOrgId` points at the legal-entity `Organisation` (role `institution`); the access gate does not use it. Optional `code` (e.g. `T-KLN`) is the public tenant identifier. `operatingModel` is `provider_operated` or `institution_operated` (who may later suspend the contract).

**In the app:** Seed creates `demo-tenant` (“Demo Clinic”, `T-KLN`), linked to KLN. Clinic tenant comes from the session cookie. Partner access is via `OrganisationRole=service_provider` + a live `ServiceContract`, not by putting partners on the tenant’s `User` list. Operator-console onboard (`clinicOnboardService`, `POST /api/partner/clinics`) creates institution org + tenant + first site + contract in one transaction.

#### User

**Purpose:** Login identity for both clinic staff and partner staff. Clinic accounts have `tenantId` + `role`; partner accounts have `tenantId=null`, `role=null`, and get their role from `OrgMembership.appRole`.

**Key fields:** `email` (unique), `passwordHash`, `accountKind` (`clinic` \| `partner`), `role` (clinic only), TOTP columns (`totpEnabled`, encrypted secret, backup hashes, pending enrollment), optional `homeAreaId`, employment dates, `anonymisedAt`.

**In the app:**

- Clinic / partner login (`userAuthService`, `/login`)
- User admin (`/users`, `userAdminService`) — invite, edit, deactivate, trigger password-reset email
- Preferred onboarding: `POST /api/users/invites` → redeem at `/invite` (`invitationService`); direct create-with-password remains for seed/dev
- Optional per-user `UserPermission` rows override the role preset (see below)
- Responsible person on devices; “raised by” on requests
- Subject of `TrainingRecord` (clinic staff only)
- Options pickers (`/api/users/options`) for assignment UIs

#### UserPermission

**Purpose:** Per-user clinic permission snapshot. **Zero rows** ⇒ fall back to `RoleGrant` (`kind=clinic`) for `User.role`. **Any rows** ⇒ those slugs are the full effective set (not a delta on top of the role).

**In the app:** Written on invite redeem when `UserInvitation.permissions` is set, and on user edit when the admin sends an explicit permission list (`userAdminService` / `getEffectiveClinicPermissions`). Capabilities API and path guards use the effective set. Empty or equal-to-preset on edit clears rows so the user tracks the role again.

#### UserInvitation

**Purpose:** SEC-07 hashed invite token for clinic (`tenantId` + `role`) or partner (`organisationId` + `appRole`) onboarding. Optional `permissions` JSON (clinic only): full permission snapshot applied as `UserPermission` rows on redeem; `null` ⇒ redeem uses the role’s `RoleGrant` preset only. Redeem sets password and marks `acceptedAt`; no magic-link session cookie.

**In the app:** `POST /api/users/invites`, `POST /api/partner/invites`, `POST /api/auth/invite/redeem`. SMTP sends the link when owner `SmtpSettings` (or platform fallback) is configured; otherwise the redeem URL is returned / logged (simulated). UI: `/invite`, clinic `InviteUserScreen`, partner staff invites.

#### PasswordResetToken

**Purpose:** SEC-07 admin-triggered password reset. Stores a **hashed** token, expiry (24h), optional `createdByUserId`, and `redeemedAt`. Clinic-scoped (`tenantId` + `userId`).

**In the app:** Admin triggers `POST /api/users/[id]/reset-password` (`users:resetpassword`) → email with `/reset-password?token=…` → `POST /api/auth/reset-password/redeem` sets the new password, bumps `sessionsValidFrom`, and marks the token redeemed. Open unredeemed tokens for the user are deleted before creating a new one. Smtp resolution uses clinic owner settings.

#### TotpChallenge

**Purpose:** Temporary row between a successful password check and a full session when 2FA is enabled. Prevents issuing a session until a TOTP / backup code succeeds.

**In the app:** Created on `POST /api/auth/login` when `totpEnabled`; consumed / deleted on `POST /api/auth/2fa/verify`. Expiry + attempt counters limit brute force. UI: second step on the login form (`/security` for enrollment).

#### TenantOxidConnection

**Purpose:** Exactly one OXID e-shop link per tenant. Holds OAuth tokens and connection metadata **server-side only** so catalog / parts / dispatch adapters can call the shop.

**In the app:** Settings → OXID panel; OAuth PKCE via `/auth/callback`; used by OXID adapters when `OXID_ADAPTER_MODE=http`. Status: `disconnected` \| `connected` \| `error`.

#### Site

**Purpose:** Physical / organisational site under a tenant (e.g. Bonn, Cologne). Carries structured address fields (`street`, `postalCode`, `city`, `country`, default `DE`) plus a denormalized `address` display line and optional delivery address.

**In the app:** `/locations`, inventarize / registration location pickers, request `siteId` + delivery address defaults. Operator console onboard writes structured fields and computes `address`. Unique `(tenantId, code)` when code is set.

#### Area

**Purpose:** Subdivision under a site (ward, room group, department). Devices and staff “home” areas hang off areas.

**In the app:** Nested under sites on `/locations`; `DeviceInstance.areaId`; optional `User.homeAreaId` for staff home ward.

#### SiteHeadcount

**Purpose:** Historised headcount for a site (validFrom / validTo). Used as evidence for regulatory **§ 6** style prerequisites during Erstanlage.

**In the app:** Registration prerequisite checks (`prerequisites` service) — release can be blocked if headcount requirements are not met.

#### SafetyOfficerAppointment

**Purpose:** Records who is appointed as safety officer (MPSB) for a site, with appointment window, optional functional email and document reference.

**In the app:** Same prerequisite gate as headcount — Erstanlage release requires site compliance data to be present where rules demand it.

---

### 4.2 Device master vs inventory (never merged)

| Model | Purpose | Where it works |
|---|---|---|
| **DeviceModel** | Article master (UDI-DI/GTIN, manufacturer, risk class, EMDN…). `source`: manual \| catalog \| beudamed \| wizard. `state`: draft \| review \| released | Catalog UI, resolve stages 2–3, Erstanlage classification, training subject |
| **DeviceInstance** | One physical unit. Unique `(tenantId, inventoryNumber)`. States: draft \| review \| released \| retired | Resolve stage 1, `/devices`, inventarize, Erstanlage release, duties, due-dates |
| **ExternalSourceRecord** | Cached BEUDAMED/OXID payloads | Resolve stage 3 cache (~90 days), external call path |
| **CapturedArticle** | Stage-4 unknown device; `serviceOnly=true` forced | `POST /api/captures`; blocks spare-parts path |
| **MaintenanceEvent** | Historical maintenance completions | Device maintenance-complete API; rolls `nextMaintenanceDueAt` |
| **DeviceUnitEvent** | Lifecycle audit on a unit (state transitions) | Registration / inventory state changes |
| **DeviceReprocessingProfile** | Per-unit reprocessing class | Erstanlage / regulatory characteristics |

**FA-102:** Catalog and BEUDAMED return a **model only**. Units enter inventory via inventarize (`POST /api/devices`) or Erstanlage **release**.

**Uniqueness (practical):**

- UDI-DI / GTIN → **model**
- Inventarnummer (`INV-#####`) → **unit** within tenant
- Serial → distinguishes units of the same model; inventarize rejects `(tenant, modelId, serial)` duplicates

#### DeviceModel

**Purpose:** Article / type master — “what kind of device is this?” Shared across tenants for the product identity (GTIN, UDI-DI, manufacturer, trade/model name, risk class, EMDN/GMDN). Not a stock unit.

**Key fields:** `basicUdiDi` (unique when set), `udiDi`, `gtins` (JSON array as text), `source` (`manual` \| `catalog` \| `beudamed` \| `wizard`), `state` (`draft` \| `review` \| `released`), optional `maintenanceCycleMonths` as model-level default.

**In the app:**

- Catalog browse / edit / XLSX import (`/catalog`, `deviceModelCatalogService`)
- Resolve stages 2–3 (local match, then OXID; BEUDAMED may create/update in `review`)
- Anchor for `DeviceModelClassification` and model-scoped training events
- Reclassify wizard (`/registration/reclassify/[modelId]`) updates classification for all tenant copies of the model

#### DeviceInstance

**Purpose:** One physical unit in a clinic’s inventory — “this pump in Bonn ICU.” Carries inventarnummer, serial, location, responsible person, lifecycle state, and maintenance schedule fields.

**Key fields:** unique `(tenantId, inventoryNumber)`; `state` `draft` \| `review` \| `released` \| `retired`; `productKindCode`; `characteristicsJson` (wizard blob); accessory tree via `parentInstanceId`; maintenance fields (`maintenanceCycleMonths`, `maintenanceAnchorAt`, `lastMaintainedAt`, `nextMaintenanceDueAt`); `source` (`wizard` \| `manual` \| `import` \| `scan` \| `external`).

**In the app:**

- Resolve stage 1 (inventory hit)
- `/devices` list & detail; inventarize after catalog/BEUDAMED service request
- Erstanlage: draft from inventarize, or create on greenfield release
- Clarifications queue (incomplete / review instances)
- Parent of duties, release snapshots, unit events, reprocessing profile
- Released instances reject identity/classification-changing PATCHes

#### ExternalSourceRecord

**Purpose:** Cached raw payload from an external registry (mainly BEUDAMED, also OXID) keyed by identifier, so resolve can avoid repeated network calls and survive soft failures.

**In the app:** Resolve stage 3 (~90-day cache window in service logic); linked to the `DeviceModel` created/updated from the lookup. Failures are logged and the chain falls through to capture.

#### CapturedArticle

**Purpose:** Stage-4 “unknown device” capture when inventory, catalog, and BEUDAMED all miss. Stores operator-entered identity plus mandatory nameplate attachment reference. Always `serviceOnly: true` — spare-parts path is forbidden.

**In the app:** `POST /api/captures` after resolve miss; service request subject type `captured`; UI state machine blocks `manual-capture → parts`.

#### MaintenanceEvent

**Purpose:** Append-only history of maintenance actions on a unit (when performed, previous/next due, cycle, note, actor). Complements the live schedule fields on `DeviceInstance`.

**In the app:** Written together with `DutyPerformance` whenever a Wartung / MAINT duty is completed — via `recordDutyCompletion` from duty complete, assignment close-out, or `POST /api/devices/[id]/maintenance-complete`. Never write Wartung completion as only one of the two rows.

#### DeviceUnitEvent

**Purpose:** Lifecycle timeline for a single unit (draft → released, retire, merge notes, etc.). Product-facing unit history distinct from global `AuditEvent`.

**In the app:** Written during registration release and inventory state transitions; shown on device detail / audit-style unit history.

#### DeviceReprocessingProfile

**Purpose:** Per-unit reprocessing assessment (class from `RefReprocessingClass`, outsourced flag, contractor, assessor). One row per instance (PK = `deviceInstanceId`).

**In the app:** Filled from Erstanlage characteristics when reprocessing applies; gates related duties / prerequisites.

---

### 4.3 Regulatory reference data (cross-tenant, seeded)

| Model | Purpose | Where it works |
|---|---|---|
| **RefRuleSet** | Versioned legal rule pack | Registration derive / preview / release |
| **RefInspectionType** | Duty kinds (wartung, stk, mtk, …) + deadline anchors | Duty derivation, `DeviceDuty.inspectionTypeCode` |
| **RefAnnex2Item** | MTK Anlage 2 items + match terms | Classification / MTK matching |
| **RefProductKind** | Product-kind matrix (shows / blocks / presets JSON) | Registration product-kind step |
| **RefReprocessingClass** / **RefReprocessingEquipmentType** | Reprocessing rules | Characteristics / profiles |
| **RefRadiationApplication** | Radiation authorisation defaults | Characteristics |
| **RefConstancyObject** | Constancy-test objects | Duties with constancy |
| **RefTrainingType** | Training type catalog | `/training`, `TrainingEvent` |
| **RefCommissioningPrerequisite** | Versioned commissioning checklist (`appliesWhen`, evidenceKind) | Erstanlage prerequisites gate |

These tables are **not** tenant-scoped. They are seeded once (`prisma/seeds/`, `GET /api/registration/ref`) and drive Erstanlage logic in TypeScript (`deriveDuties`, product-kind matrix, prerequisites).

#### RefRuleSet

**Purpose:** Versioned legal / standards pack (code, title, legal basis, validity window). Parent of most other `Ref*` rows and of model classifications.

**In the app:** Registration derives duties against the active rule set; snapshots store which rule-set IDs were in force at release.

#### RefInspectionType

**Purpose:** Catalog of inspection / duty kinds (Wartung, STK, MTK, IT-Sicherheit, …) with deadline anchor semantics (`month_end`, `year_end`, `exact_day`, `event`, `interval`, `process`, `permanent`) and default intervals.

**In the app:** Maps to frozen `DeviceDuty.inspectionTypeCode`; drives how `dueAt` is computed (`dueDate()` helpers).

#### RefAnnex2Item

**Purpose:** MTK Anlage 2 hierarchy (item numbers, groups, intervals, match terms / excludes as JSON). Used to match a device’s characteristics to an MTK obligation.

**In the app:** Linked from `DeviceModelClassification.mtkItemId`; matching confidence `verified` \| `derived` \| `guess`. Seeded from Anlage-2 rule data (e.g. `data/mtk-anlage2-regeln.json`).

#### RefProductKind

**Purpose:** Product-kind codes that control which characteristic questions show, which are blocked, and which presets apply (`shows` / `blocks` / `presets` JSON).

**In the app:** Early Erstanlage step / product-kind picker; `DeviceInstance.productKindCode`; APIs under `/api/registration/product-kinds`.

#### RefReprocessingClass

**Purpose:** Allowed reprocessing classes (label, QMS cert requirement, notes).

**In the app:** Chosen on characteristics; stored on `DeviceReprocessingProfile.classCode`.

#### RefReprocessingEquipmentType

**Purpose:** Equipment types for reprocessing validation (standards, revalidation months, routine checks JSON). Informs derived duties / evidence hints when equipment is in scope.

**In the app:** Registration characteristics and duty derivation for reprocessing equipment.

#### RefRadiationApplication

**Purpose:** Radiation application codes with default authorisation (`notification` \| `licence`).

**In the app:** Characteristics when radiation applies; influences classification flags and prerequisites.

#### RefConstancyObject

**Purpose:** Constancy-test object catalog with default cadence.

**In the app:** Duties that reference a constancy object (`DeviceDuty.constancyObjectCode`).

#### RefTrainingType

**Purpose:** Types of mandatory / optional training (legal basis, subject kind `model` \| `activity`, validity months, whether chain training is allowed).

**In the app:** `/training` create flow; `TrainingEvent.trainingTypeCode`.

#### RefCommissioningPrerequisite

**Purpose:** Versioned commissioning checklist items under a `RefRuleSet` (was hard-coded). Each row has `code`, `label`, `legalBasis`, `mandatory`, `evidenceKind` (`confirmation` \| `document` \| `third_party`), `appliesWhen` (expression over Merkmale), and `releaseLevel`.

**In the app:** Evaluated during Erstanlage prerequisites (`prerequisites` service). Level 1 confirmations are checkboxes; level ≥2 documents need `DeviceEvidence` + blob; third_party needs `externalRecordRef`. Seeded with other `Ref*` data; exposed via registration ref APIs.

---

### 4.4 Classification, release freeze, duties

| Model | Purpose | Where it works |
|---|---|---|
| **DeviceModelClassification** | Historised model Einstufung (`validTo` null = open). confidence: verified \| responsible \| derived \| guess (+ determination / not_applicable). C4: productKindCode, characteristics, fieldStates, decisions, deferredFields | Erstanlage, reclassify wizard, model catalog |
| **DeviceReleaseSnapshot** | Immutable freeze at release (characteristics, derivedDuties, prerequisites JSON + evidence ids) | `POST /api/registration/release` |
| **DeviceDuty** | Frozen per-instance obligations + `dueAt`; category (inspection\|operating), setsBaseline / requiresBaseline, referenceDeviceId | `/due-dates`, device duties APIs, assignment → service request |
| **DeviceEvidence** | Commissioning evidence (blob or external ref) keyed by prerequisiteCode | Erstanlage prerequisites / release gate |
| **DeviceClarification** | Deferred classification/evidence gaps | Klärliste + draft defer |
| **ReprocessingOnDevice** | Product exemplar ↔ equipment exemplar | AUF-01 validation reference |
| **DutyPerformance** | Completions that roll next due | `POST /api/duties/[id]/complete` |

Flow: wizard answers → `deriveDuties` (TS, no silent rewrite after freeze) → preview → release → snapshot + duties.

#### DeviceModelClassification

**Purpose:** Historised **Einstufung** at model level (STK yes/no, MTK annex item, radiation, software class, confidence, evidence). Open row = `validTo` null; reclassify closes the old row and inserts a new one.

**In the app:** Erstanlage / reclassify wizards; Erstanlage release defaults to `confidence=responsible` (named person + protocol). `verified` is reserved for statute/norm-backed ref data and explicit catalogue confirmations. Shown on catalog / model context; second inventarize of the same model reuses `characteristics` / `fieldStates`.

#### DeviceReleaseSnapshot

**Purpose:** Immutable freeze of everything that justified going live: rule-set IDs, classification id, characteristics JSON, derived duties JSON, prerequisites JSON, app version, releaser, timestamp.

**In the app:** Written only on `POST /api/registration/release` (or reclassify apply). Parent of the `DeviceDuty` rows created in that freeze. Used for auditability — later UI must not silently mutate past freezes.

**Snapshot vs living duty:** The snapshot answers “what applied at release”; `DeviceDuty` rows answer “what applies today” (`dueAt` rolls, `suspendedAt`, `notifyStage`). A difference between the two is expected. A rule-set correction must produce a **new** snapshot (via reclassify / re-release), not an in-place update of an old freeze.

#### DeviceDuty

**Purpose:** One frozen obligation on one instance (Wartung, STK, MTK, …). Holds interval, deadline anchor, computed `dueAt`, applicability, suspension, reminder stage placeholders, and links back to the snapshot.

**In the app:**

- `/due-dates` tenant-wide list (`duties:view`)
- Device detail open duties; `nextObligationDueAt` = min applicable `dueAt`
- Assign → create `ServiceRequest` with `dutyId` / `source=due_date`
- Complete via `POST /api/duties/[id]/complete` (rolls `dueAt`; Wartung also updates instance maintenance fields)

#### DutyPerformance

**Purpose:** Completion history for a duty (result, performer, optional linked service request). Driving record for rolling the next due date (FA-715). Shared helper `recordDutyCompletion` is the only write path.

**In the app:** Created on every duty completion (duty API, service-request assignment complete, maintenance-complete). For `dutyKey=wartung` / `inspectionTypeCode=MAINT`, the same helper also creates `MaintenanceEvent` and syncs instance maintenance fields.

#### DeviceEvidence

**Purpose:** Commissioning evidence for one prerequisite on one instance. Keyed by unique `(deviceInstanceId, prerequisiteCode)`. Holds `evidenceKind`, optional `attachmentBlobId`, `externalRecordRef`, issuer/validity, and who recorded it.

**In the app:** `POST /api/registration/drafts/[id]/evidence`; release gate checks that required prerequisites are satisfied. Snapshot freezes evaluated list + evidence ids.

#### DeviceClarification

**Purpose:** Deferred classification / evidence / mandatory-field gaps while an instance stays `draft` (or open Klärliste items). Fields: `kind`, optional `field` / `prerequisiteCode`, `label`, deferredBy/At, resolution fields.

**In the app:** Written when the wizard defers (C3); Klärliste unions computed inventory issues with open clarifications (`POST /api/clarifications/[id]/resolve`). No release while classification|evidence clarifications remain open.

#### ReprocessingOnDevice

**Purpose:** Links a product exemplar (`profileDeviceId`) to a reprocessing equipment exemplar (`equipmentDeviceId`) for AUF-01 validation references. Historised with `validFrom` / `validTo` (open row = `validTo` null); unlink closes the row so recall queries keep prior links. At most one open pair via unique `openLinkKey`. Tenant-scoped.

**In the app:** CRUD under `/api/devices/[id]/reprocessing-links`. Validation calendar duties live on equipment; products get `referenceDeviceId` / anchor `reference`. Rejects outsourced profile + in-house links. Rejects equipment that is not a reprocessing device (`productKindCode=aufbereitungsgeraet` or Merkmale `istAufbGeraet` + `eigenTyp`).

---

### 4.5 Partners & contracts

| Model | Purpose | Where it works |
|---|---|---|
| **Organisation** | Legal entity once (partners and institutions) | Partner seed, contracts |
| **OrganisationRole** | Capacity: institution \| service_provider \| inspection_partner \| platform_operator | Manage-tenant gate |
| **OrgMembership** | Partner user ↔ org; `appRole`: inspector \| admin \| order | Partner login door |
| **ServiceContract** | Org may open one clinic; `scope` JSON; `terminatedAt` / `suspendedAt`; optional `billingRef` | Partner home / console / access control |
| **ExecutorOrg** | In-clinic executor catalog (O-MSR, O-RTS, O-INT) | Service request allocation (FA-713), dispatch targets per org |
| **SmtpSettings** | Outbound SMTP for clinic tenant **or** partner org (exactly one owner) | Settings SMTP panels, invite/reset/dispatch mail |

#### Organisation

**Purpose:** Every legal entity once. Capacity is not inferred from the table — it lives on `OrganisationRole`. Seeded partners (MSR, RTS) and leftover institution rows (KLN, PRX, MVZ, ZAH).

**In the app:** Partner portal identity; linked to clinics only through `ServiceContract` when the org currently holds `service_provider`.

#### OrganisationRole

**Purpose:** States in which capacity the organisation appears, with a validity window. The same company can be `service_provider` and `inspection_partner`.

**In the app:** `assertPartnerManagesTenant` requires a current `service_provider` row. Inspection-only orgs (RTS) cannot open clinic inventory.

#### OrgMembership

**Purpose:** Places a partner `User` inside an organisation with an `appRole` (`inspector` \| `admin` \| `order`) and validity window.

**In the app:** Partner login door; authorises partner UI capabilities. Clinic users do **not** get membership rows.

#### ServiceContract

**Purpose:** Live commercial / operational link: this organisation may access this tenant, with a `scope` JSON (e.g. inventory, due-dates, inspection), validity dates, optional `billingRef`, and optional `terminatedAt` / `suspendedAt`.

**In the app:** `requireActingContext` + `partnerHomeService` + operator-console customer list. A live contract is `validFrom ≤ now`, open `validTo`, and both `suspendedAt` / `terminatedAt` null. Scope is intersected with `appRole` before any shared write. Without a live contract the tenant is invisible to the organisation — rights do not have to be revoked person by person.

**Lifecycle (Wave 2):** `suspendContract` / `resumeContract` / `terminateContract` (`contractLifecycleService`). Who may mutate depends on `Tenant.operatingModel`: `institution_operated` → clinic `superadmin`; `provider_operated` → partner `admin` for the contracting org. Routes: `POST /api/partner/contracts/[id]/{suspend|resume|terminate}` and clinic mirror under settings/admin.

#### ExecutorOrg

**Purpose:** Clinic-local catalog of who executes work (internal team or named external codes like O-MSR / O-RTS). Distinct from global `Organisation` — FA-713 allocation lives here so each clinic can configure its executors.

**In the app:** Service request allocation (`executorOrgId`); optional owner of `DispatchTarget`s so each executor has its own mail/API endpoints.

#### SmtpSettings

**Purpose:** Owner-scoped outbound SMTP credentials. Exactly one of `tenantId` or `organisationId` is set (unique on each). Password stored AES-GCM encrypted in `passEnc`; public DTOs never return the secret.

**Key fields:** `host`, `port` (default 587), `secure`, `user`, `passEnc`, `fromAddr`, `updatedByUserId`.

**In the app:** Clinic Settings → SMTP (`/api/settings/smtp`, `settings:smtp`); partner console Settings (`/api/partner/settings/smtp`). Resolution order for mail dispatch (`resolveSmtp`): optional `DispatchTarget.auth` override → owner `SmtpSettings` → platform `SMTP_*` env → simulate. Invite and password-reset mail use owner settings (no target auth). `DispatchTarget.endpoint` remains the **recipient** address, not the SMTP identity.

---

### 4.6 Training

| Model | Purpose | Where it works |
|---|---|---|
| **TrainingEvent** | Schulungstermin (model or activity subject) | `/training`, `trainingService` |
| **TrainingRecord** | Per clinic-staff User proof | Same; subjects are clinic users only |

#### TrainingEvent

**Purpose:** One Schulungstermin — date, location, instructor, mode (`individual` \| `group`), basis document. Subject is either a `DeviceModel` **or** an activity string (exactly one, enforced in app).

**In the app:** `/training` overview and create; records proofs for attendees.

#### TrainingRecord

**Purpose:** Individual proof that a clinic staff `User` attended an event (`personId`), with optional `validUntil`.

**In the app:** Created with the event; unique `(eventId, personId)`. Never points at partner users.

---

### 4.7 Service requests, orders, dispatch

| Model | Purpose | Where it works |
|---|---|---|
| **ServiceRequest** | Idempotent create (`idempotencyKey` + `fingerprint`); subject instance \| model \| captured; optional `dutyId`, `executorOrgId` | Scan workflow, `/requests`, due-date assignment |
| **StatusEvent** | State history | Transitions + downstream status feedback |
| **Attachment** / **AttachmentBlob** | Photos / files | Capture + request submit; offline queue stores downscaled images |
| **DispatchTarget** | Per-tenant (and optional executor) endpoints: mail \| oxid \| webhook | Seed + dispatch |
| **DispatchRecord** | Per-send outcome | After create; request → `transmitted` if ≥1 success |
| **OrderRequest** / **OrderItem** | Spare-parts cart | Parts flow; blocked for `serviceOnly` captures |

#### ServiceRequest

**Purpose:** Primary work ticket for service / inspection work raised from scan, due-dates, or apps. Idempotent create via unique `idempotencyKey` + content `fingerprint` (safe offline retries).

**Key fields:** `reference` (human id), `subjectType` / `subjectId` (`instance` \| `model` \| `captured`), `serviceType`, location/delivery/contact, `state` (starts `captured`), `source` (`app` \| `due_date`), optional `dutyId`, allocation fields (`executorOrgId`, `allocatedAt`, `transmittedAt`).

**In the app:** Home scan workflow; `/requests`; due-date assign; dispatch pipeline; transitions and downstream status webhooks.

#### StatusEvent

**Purpose:** Append-only state timeline for a service request (who/what/source changed state).

**In the app:** Written on create (`captured`), staff transitions, and external status feedback (`POST .../status`). Powers request detail history.

#### Attachment

**Purpose:** Metadata row linking a service request to a stored file/URL (photo of fault, nameplate copy, etc.).

**In the app:** Created with the request in the same transaction; offline queue downscales photos before submit.

#### AttachmentBlob

**Purpose:** Tenant-scoped storage for large data-URLs when the app persists blobs in MySQL (e.g. nameplate / evidence images) rather than only external URLs. Optional `contentType` / `byteSize` parsed from the data-URL prefix on create.

**In the app:** Capture, evidence upload, and service-request photo paths; `GET /api/attachments/[id]` serves content when needed.

#### DispatchTarget

**Purpose:** Configured outbound channel for a tenant (and optionally an `ExecutorOrg`): type `mail` \| `oxid` \| `webhook`, endpoint, auth/mapping JSON, retry policy, enabled flag.

**In the app:** Seeded defaults; `dispatchService` loads enabled targets after request create. Failures are isolated per target.

#### DispatchRecord

**Purpose:** Outcome of one send attempt (success, HTTP status, response/error snippet, attempt count, correlation id).

**In the app:** Written per target; request becomes `transmitted` once at least one target succeeds. Visible on request detail / ops debugging.

#### OrderRequest

**Purpose:** Spare-parts order — separate lifecycle from service requests. Has its own reference, idempotency, approval state (default `pending_approval`), and line items.

**In the app:** Parts / cart flow after resolve when subject is not `serviceOnly`. Manual capture subjects cannot order parts.

#### OrderItem

**Purpose:** Line on an order (article number, description, quantity, optional unit price / article id).

**In the app:** Built from the parts cart UI; stored with the parent `OrderRequest`.

---

### 4.8 Cross-cutting ops

| Model | Purpose | Where it works |
|---|---|---|
| **ExternalCallLog** | Hashed external call telemetry | BEUDAMED / OXID adapters |
| **RoleGrant** | RBAC matrix keyed by `kind` + `role` + `permission` | Seed + clinic `/roles`; partner console/acting caches |
| **AuditEvent** | Append-only product audit (actor snapshotted, no join later) | `auditService`, `/activity`, resource history APIs |
| **DutyReminder** | One row per duty × reminder stage; delivery status | OPS-01 due-date cron |
| **DispatchOutbox** | Durable retry queue for failed dispatch attempts | OPS-02 outbox cron; enqueue-on-failure |

#### ExternalCallLog

**Purpose:** Telemetry for outbound calls (BEUDAMED, OXID, …): system, operation, **hashed** identifier, duration, cache hit, success, HTTP status. Supports ops without storing raw identifiers in logs.

**In the app:** Written by adapter / shared logging helpers during resolve and shop calls. Not a user-facing screen by default.

#### RoleGrant

**Purpose:** RBAC matrix rows: which `permission` slugs each `role` has, isolated by `kind` (`RoleGrantKind`):

| `kind` | Used for |
|---|---|
| `clinic` | Clinic `User.role` presets; editable on `/roles` |
| `partner_console` | Partner portal / console capabilities by `appRole` |
| `partner_acting` | Baseline when a partner acts in a clinic (then ∩ contract scope) |

Unique `(kind, role, permission)`. Seeded from static catalogs (`ROLE_PERMISSIONS`, `CONSOLE_ROLE_PERMISSIONS`, `PARTNER_ROLE_PERMISSIONS`); runtime prefers DB with static fallback.

**In the app:** Clinic `/roles` UI edits `kind=clinic` only; `roleGrantsService` + `GET /api/me/capabilities`; path guards (`canAccessPath`). Some superadmin permissions are locked. Partner kinds are not edited via the clinic roles screen.

#### AuditEvent

**Purpose:** Append-only product audit trail. Actor fields are **snapshots** (name, role, kind, org) so history survives user renames/deletes — do not join `User` later for display.

**In the app:** `auditService` on sensitive mutations; `/activity` screen (clinic + partner); per-resource history (`/api/audit/resources/...`); CSV export.

#### DutyReminder

**Purpose:** OPS-01 — one row per `DeviceDuty` × reminder stage (`T-90` \| `T-30` \| `T-7` \| `due` \| `overdue`). Tracks `scheduledFor`, `status` (`ReminderStatus`: pending \| sent \| failed \| skipped), attempts, and `lastError`.

**In the app:** Created/advanced by `POST /api/jobs/due-dates` (`dueDateReminderJob`); unique `(deviceDutyId, stage)`.

#### DispatchOutbox

**Purpose:** OPS-02 — durable retry queue when a dispatch target fails. `DispatchRecord` remains the attempt log; outbox rows hold `state` (`OutboxState`: pending \| processing \| delivered \| dead), `nextAttemptAt`, attempts, correlation id. Unique `(serviceRequestId, targetId)`.

**In the app:** Enqueued automatically on dispatch failure (`enqueue-on-failure`); drained by `POST /api/jobs/dispatch-outbox` (`dispatchOutboxJob`).

---


## 5. Core workflows

### 5.1 Resolve chain (`POST /api/resolve`)

```
Identifier (GS1 / INV / GTIN)
        │
        ▼
1. DeviceInstance (tenant) ──hit──► instance + model
        │ miss
        ▼
2. DeviceModel local → OXID CatalogSearchAdapter ──hit──► model only
        │ miss
        ▼
3. ExternalSourceRecord cache / BEUDAMED ──hit──► DeviceModel (often review)
        │ miss / soft-fail
        ▼
4. Client → CapturedArticle (serviceOnly)
```

- **UI:** `scanStore`
- **Service:** `src/services/resolve/resolveService.ts`
- **Tables:** `DeviceInstance`, `DeviceModel`, `ExternalSourceRecord`, `CapturedArticle`, `ExternalCallLog`

### 5.2 Erstanlage / registration

```
/registration (client wizard)
  → POST /api/registration/preview   (deriveDuties; no DB draft for greenfield)
  → POST /api/registration/drafts/[id]/evidence  (DeviceEvidence + AttachmentBlob)
  → POST /api/registration/release
       creates/updates DeviceInstance (releaseLevel from Merkmale max)
       writes DeviceModelClassification (confidence=responsible on Erstanlage)
       DeviceReleaseSnapshot + DeviceDuty rows (category / baseline / reference)
```

Inventarize path: `POST /api/devices` → draft instance → `/registration/[id]` → release with `draftId`.

**Prerequisites (C2):** Seeded `RefCommissioningPrerequisite` (`appliesWhen` over Merkmale, `evidenceKind` confirmation|document|third_party). Level 1 = checkboxes; level ≥2 requires `DeviceEvidence` with blob for documents; third_party needs `externalRecordRef` (never checkbox). Snapshot freezes evaluated list + evidence ids.

**Draft defer (C3):** Incomplete Erstanlage may stay `state=draft` with `DeviceClarification` rows (`kind`, `field` / `prerequisiteCode`, deferredBy/At). Klärliste unions computed inventory issues with open clarifications (`POST /api/clarifications/[id]/resolve`). No release while classification|evidence clarifications remain open.

**Model reuse (C4):** Model-owned Merkmale live on `DeviceModelClassification.characteristics` / `fieldStates` / `decisions` / `deferredFields`. Instance-owned (`aedExemption` / `aedAusnahme`, reprocessing class, site/room) stay on the instance. Second inventarize of the same model pre-fills from the open classification.

**AED (STK):** The AED layperson/public-space question (`aedAusnahme`) is shown only for product kinds `aktiv-therapie` and `sonstiges` (`showsAedExemptionQuestion`). When answered yes, STK is **not** applicable even if Anlage 1 or Altgerät would otherwise trigger it — one STK duty row, exemption wins. `DeviceModelClassification.stk` is set from that same derived duty (`stkFlagFromDuties`), not a second expression.

**Reprocessing (C5):** `ReprocessingOnDevice` links product → equipment exemplars (`validFrom`/`validTo` history). At most one open row per pair via `openLinkKey`. Validation calendar duties only on equipment; products get `referenceDeviceId` / anchor `reference`. Reject outsourced profile + in-house links; reject non-equipment targets. Reclassify that drops equipment identity closes open equipment-side links. Product validation status is derived from linked equipment performances.

**Duty derivation (`deriveDuties`) — fixture-aligned rules:**

| Rule | Behaviour |
|---|---|
| **P1** | `applicable=false` ⇒ `deadlineAnchor=none`, no interval, `confidence=n/a` (`withMeta`) |
| **P2** | Single STK duty; grounds = Anlage 1 and/or MedGV Altgerät, overridden by AED exemption |
| **P3** | Wartung calendar duty skipped for implants; IFU interval is operator `determination` when applicable |
| **P6** | Accessory (`zubehoer`) evidence follows its reprocessing class (`requiresValidatedProcess`), not a blanket validation duty |
| **AUF-01** | Validation due lives on equipment (**`year_end`**, product decision 30.09.); products reference linked equipment |

Abnahme sets baseline; Konstanz requires baseline before complete. Erstanlage release defaults classification `confidence=responsible`; reclassify apply defaults `verified`.

**Product decision:** validation equipment deadline anchor is **`year_end`** (not `exact_day`). Still open: official Anlage-2 interval confirmation vs seeded match data.

**Tables:** `DeviceInstance`, `DeviceModel`, `DeviceModelClassification`, `DeviceReleaseSnapshot`, `DeviceDuty`, `DeviceEvidence`, `DeviceClarification`, `ReprocessingOnDevice`, `Ref*` (incl. `RefCommissioningPrerequisite`), `DeviceUnitEvent`; prerequisites also use `SiteHeadcount` / `SafetyOfficerAppointment`.

**Services:** `src/services/registration/*` (deriveDuties, prerequisites, writeDuty, evidence, reprocessingLink, release, draft). Fixture: `npm run test:pflichten` (`fixtures/pflichten/`, 222 cases / 1,197 duties).

### 5.3 Service request + dispatch

```
POST /api/service-requests
  → transaction: ServiceRequest + StatusEvent(captured) + Attachment*
  → dispatchService → DispatchTarget adapters
  → DispatchRecord per target
  → state transmitted if any success
```

Optional link: `DeviceDuty` → request (`dutyId`); completion → `DutyPerformance` + roll `dueAt`.

**Services:** `src/services/requests/serviceRequestService.ts`, `src/services/dispatch/*`.

### 5.4 Auth

```
POST /api/auth/login (User.passwordHash)
  → if totpEnabled: TotpChallenge + challenge cookie
  → POST /api/auth/2fa/verify → session cookie (HMAC, 12h)

Invite (preferred clinic/partner onboard):
  POST /api/users/invites | /api/partner/invites
  → UserInvitation (optional permissions JSON for clinic)
  → email / simulated URL → /invite
  → POST /api/auth/invite/redeem → User (+ UserPermission if snapshot) ; no session from link

Password reset (admin-triggered):
  POST /api/users/[id]/reset-password → PasswordResetToken + email
  → /reset-password?token=… → POST /api/auth/reset-password/redeem
  → new passwordHash + sessionsValidFrom bump
```

Partner path: same `User` row with `accountKind=partner` + `OrgMembership` + `ServiceContract` scopes.

**Services:** `src/services/auth/userAuthService.ts`, `totpService.ts`, `invitationService.ts`, `passwordResetService.ts`.

---

## 6. Client architecture

| Store | Job |
|---|---|
| `scanStore` | Resolve → classify → service/parts → success \| queued state machine |
| `requestStore` | Draft request fields / cart |
| `sessionStore` | Client mirror of `/api/auth/session` (user / tenantName); no local PIN lock |
| `offlineQueueStore` + `idb` | Queue failed submits; `replayQueue` mutex |
| `themeStore` / `toastStore` / `logStore` | UX chrome |

Offline replay rules: 2xx remove · 409 mark synced · 400/404/422 keep with error · 5xx/network retry later · 401/403 stop and re-authenticate.

---

## 7. Security (schema-related)

- Session: signed httpOnly cookie; clinic tenant from cookie only; partner acting tenant from `x-acting-tenant-id` only (never body/query).
- **SEC-03 session revoke:** `User.sessionsValidFrom` — on deactivate, role change, or password reset the timestamp is bumped; `readSession` rejects cookies whose `iat` is older.
- **SEC-04 lockout:** `failedLoginAttempts` / `lockedUntil` on `User` (threshold via `AUTH_MAX_FAILED_LOGINS`, duration via `AUTH_LOCKOUT_MINUTES`).
- Passwords: hashed (`src/lib/password`); TOTP, OXID tokens, and SMTP `passEnc` AES-GCM via `src/lib/crypto/secretBox.ts`.
- **SEC-01 tenant guard:** `AsyncLocalStorage` bound in `requireTenantContext` / `requireActingContext`; Prisma `$extends` injects `tenantId` on tenant-scoped models and throws if no context. Seed/tests/jobs use `runWithoutTenant` / `bindTenantBypass`. Unguarded client: `prismaSystem`. `UserInvitation` is allowlisted when clinic-scoped; org-scoped invites and redeem use `runWithoutTenantAsync`. `PasswordResetToken` is tenant-scoped; redeem runs without tenant.
- **SEC-02:** child tables (`Attachment`, `StatusEvent`, `DispatchRecord`, `OrderItem`, `Area`, `SiteHeadcount`, `SafetyOfficerAppointment`) carry `tenantId` with FK.
- **SEC-06:** MySQL triggers reject `UPDATE`/`DELETE` on `AuditEvent` (append-only). App DB user should also lack those privileges (ops).
- **SEC-07 invites & resets:** `UserInvitation` + hashed token (optional clinic `permissions` snapshot → `UserPermission`); `PasswordResetToken` + hashed token. Redeem sets password (no session cookie from the link).
- RBAC: clinic effective permissions = `UserPermission` snapshot or `RoleGrant` (`kind=clinic`) + path guard `canAccessPath`. Partner: `RoleGrant` `partner_console` / `partner_acting` (static fallback) ∩ contract scope for acting; reserved slugs (`users:*`, `roles:*`, `training:*`, `settings:*`, `catalog:update`) stripped from acting.
- Audit: `AuditEvent` is append-only with actor **snapshots** built in the gate (`actorKind` clinic vs partner + `organisationId` / `serviceContractId`). Do not join `User` later for history.
- External identifiers in logs: hashed in `ExternalCallLog`.
- Capturers (`role=user`): no `shell:nav`, but home (`/`) and `/security` remain reachable.

### Wave 2 schema hygiene (bucket B)

| Item | Change |
|---|---|
| **B1 enums** | `DeviceState`, `ServiceRequestState`, `OutboxState`, `ReminderStatus`, `PartnerAppRole`, `TrainingMode`, `OperatingModel` on load-bearing columns |
| **B2 contracts** | Operating-model–gated suspend / resume / terminate; live gate unchanged |
| **B3 site address** | `Site.street` / `postalCode` / `city` / `country` + denormalized `address` |
| **B4 ref JSON** | `RefProductKind.shows\|blocks\|presets`, `RefAnnex2Item.matchTerms\|matchExclude` as Prisma `Json` (release snapshots stay LongText) |
| **B5 completion** | Shared `recordDutyCompletion` → always `DutyPerformance`; Wartung also `MaintenanceEvent` |
| **B6 invites** | `UserInvitation` + create/redeem APIs + SMTP-aware mail |
| **B7 blobs** | `AttachmentBlob.contentType` / `byteSize` |

### Post–Wave 2 (RBAC / mail / reset)

| Item | Change |
|---|---|
| **RoleGrant.kind** | `RoleGrantKind`: `clinic` \| `partner_console` \| `partner_acting`; unique `(kind, role, permission)` |
| **UserPermission** | Per-user clinic snapshot; empty ⇒ role preset from `RoleGrant` (`kind=clinic`) |
| **Invite permissions** | `UserInvitation.permissions` JSON → `UserPermission` rows on redeem |
| **SmtpSettings** | Owner-generic SMTP (`tenantId` xor `organisationId`); AES-GCM `passEnc` |
| **PasswordResetToken** | Admin-triggered reset email + `/reset-password` redeem |

### SWOT finishing (30.09.)

| Item | Change |
|---|---|
| **ReprocessingOnDevice history** | `validFrom` / `validTo`; unlink closes the open row |
| **Equipment invariant** | Link rejects non-reprocessing targets; reclassify closes stale equipment links |
| **Open link uniqueness** | `openLinkKey` (`profileId:equipmentId`) unique while open — SCH-02 style |
| **Enums** | `OrganisationCapacity`, `ClinicRole`, `DutyPerformanceResult`, `OrderApprovalState`, `OrderRequestState` |
| **termMatchConfidence** | Renamed from `matchConfidence`; narrowed to `TermMatchConfidence` (`verified` \| `derived`) |
| **DutyKey / IntervalUnit** | Persisted as Prisma enums; dynamic duty ids map via `canonicalDutyKey` |
| **Confidence.guess** | Deprecated; write/read normalize to `derived` |
| **Validation anchor** | Product decision: equipment validation stays **`year_end`** |
| **OrderRequestState** | Create stamp only (`captured`); spare-parts lifecycle is `OrderApprovalState` |
| **deriveDuties P1–P3 / P6** | NA meta; one STK; Wartung determination / implant N/A; accessory evidence by class |
| **AED UI + STK** | Question only aktiv-therapie / sonstiges; exemption overrides Anlage1/Altgerät |
| **Classification.stk** | Written from `stkFlagFromDuties(preview.duties)` — one expression with derivation |
| **Client PIN lock** | Removed (`LockScreen` / idle PIN); `sessionStore` is session mirror only |
| **Pflichten fixture** | `fixtures/pflichten/` + `npm run test:pflichten` — **222 cases / 1,197 duties** (v20) |

### Cron jobs (OPS-01 / OPS-02)

| Route | Purpose | Auth |
|---|---|---|
| `POST /api/jobs/due-dates` | Advance `DeviceDuty.notifyStage`, write `DutyReminder` | `Authorization: Bearer $CRON_SECRET` |
| `POST /api/jobs/dispatch-outbox` | Retry failed dispatch via `DispatchOutbox` | same |

Scripts: `npx tsx scripts/runDueDateReminders.ts`, `npx tsx scripts/runDispatchOutbox.ts`.

Schedule both URLs from external cron (e.g. every 15 minutes). Failed dispatch targets are enqueued automatically (`enqueue-on-failure`).

### SCH uniqueness

- `DeviceInstance` unique `(tenantId, modelId, serialNumber)` (NULLs allowed).
- `DeviceModelClassification.openClassificationKey` unique while open (`= deviceModelId`, cleared when `validTo` set).

---

## 8. Entity relationship (simplified)

```
Tenant ─┬─ User (clinic) ── UserPermission?
        ├─ SmtpSettings?
        ├─ PasswordResetToken / UserInvitation (clinic)
        ├─ Site ─ Area ─┬─ DeviceInstance* ─┬─ DeviceDuty* ─ DutyPerformance
        │               │                   ├─ DeviceReleaseSnapshot
        │               │                   ├─ DeviceEvidence / DeviceClarification
        │               │                   ├─ MaintenanceEvent
        │               │                   ├─ ReprocessingOnDevice
        │               │                   └─ DeviceReprocessingProfile
        ├─ ServiceRequest ─┬─ StatusEvent / Attachment / DispatchRecord
        │                  ├─ DispatchOutbox
        │                  └─ (optional) DeviceDuty / ExecutorOrg
        ├─ OrderRequest ─ OrderItem
        ├─ DispatchTarget / ExecutorOrg
        ├─ DutyReminder (via DeviceDuty)
        ├─ TrainingEvent ─ TrainingRecord → User
        └─ ServiceContract → Organisation ← OrganisationRole
                                          ← OrgMembership ← User (partner)
                                          ← SmtpSettings? / UserInvitation (partner)

DeviceModel ─┬─ DeviceInstance*
             ├─ DeviceModelClassification → RefAnnex2Item / RefRuleSet
             ├─ ExternalSourceRecord
             └─ TrainingEvent (subject)

RoleGrant (kind: clinic|partner_console|partner_acting)
AuditEvent (tenant-scoped rows)    TotpChallenge → User
Ref* (global reference, incl. RefCommissioningPrerequisite)
```

---

## 9. Adapter boundary

External systems sit behind interfaces and an env mode switch:

| Env | Modes |
|---|---|
| `OXID_ADAPTER_MODE` | `mock` \| `http` |
| `BEUDAMED_ADAPTER_MODE` | `mock` \| `stub` \| `http` |

Schema and BFF stay the same; only adapter implementations under `src/services/adapters/` change when real contracts are filled in.

---

## 10. Seeded clinic users

| Email | Name | Role |
|---|---|---|
| `admin@demo.local` | Admin Klinik | `superadmin` |
| `anna@demo.local` | Anna Technik | `device_admin` |
| `clara@demo.local` | Clara Sicherheit | `security_officer` |
| `ben@demo.local` | Ben Pflege | `user` |

Password for all demo clinic accounts: **`demo`**. Use the clinic login door. Partner demo users are seeded separately (`prisma/seeds/partnerOrgs.ts`).

---

## Related docs

- [`PROJECT.md`](./PROJECT.md) — product overview, screens, API surface, offline, testing
- [`../README.md`](../README.md) — quick start and adapter notes
- `prisma/schema.prisma` — canonical table definitions
