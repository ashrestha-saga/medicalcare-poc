# DeviceCare — Project Documentation

Mobile-first web application for clinical technicians and nursing staff: scan or enter a medical device identifier, resolve it through a four-stage chain, receive a classification **suggestion**, and raise a service request or spare-parts order — online or offline.

This document describes how the system works, the domain model, and the technical features available in the codebase.

---

## Table of contents

1. [Overview](#1-overview)
2. [Tech stack](#2-tech-stack)
3. [Repository layout](#3-repository-layout)
4. [Domain model](#4-domain-model)
5. [Application screens](#5-application-screens)
6. [API surface](#6-api-surface)
7. [Device resolution pipeline](#7-device-resolution-pipeline)
8. [Classification](#8-classification)
9. [Service requests & spare-parts orders](#9-service-requests--spare-parts-orders)
10. [Dispatch (mail / OXID / webhook)](#10-dispatch-mail--oxid--webhook)
11. [Post-request inventarize](#11-post-request-inventarize)
12. [Inventory & catalog](#12-inventory--catalog)
13. [Authentication & session](#13-authentication--session)
14. [TOTP two-factor authentication](#14-totp-two-factor-authentication)
15. [Roles & permissions (RBAC)](#15-roles--permissions-rbac)
16. [Offline queue](#16-offline-queue)
17. [External adapters](#17-external-adapters)
18. [Security practices](#18-security-practices)
19. [Configuration (env)](#19-configuration-env)
20. [Local development](#20-local-development)
21. [Testing](#21-testing)
22. [Seed data & demo identifiers](#22-seed-data--demo-identifiers)

---

## 1. Overview

**DeviceCare** helps hospital staff identify medical devices quickly and open the right follow-up workflow:

| Goal | How |
|---|---|
| Identify a device | Camera barcode scan or manual entry (inventory number, GTIN, GS1 with serial, etc.) |
| Resolve identity | Four-stage chain: inventory → catalog → BEUDAMED → manual capture |
| Classify for service | Rule-based **suggestion** (verified / derived / guess) — never silent auto-commit for unverified rules |
| Act | Create a **service request** or **spare-parts order** |
| Work offline | Failed or offline submits land in IndexedDB and replay later |
| Grow inventory | After a catalog/BEUDAMED service request, optionally **inventarize** the unit (auto `INV-#####` + mandatory serial) |

Tenancy is strict: every inventory row, request, and dispatch target belongs to a **Tenant**. The tenant is always taken from the signed session cookie — never from a client-supplied body field.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Route Handlers as BFF) |
| UI | **React 19**, TypeScript, **Tailwind v4**, Radix primitives |
| State | **Zustand** (`scanStore`, `requestStore`, `sessionStore`, `offlineQueueStore`, …) |
| Validation | **zod** |
| Persistence | **Prisma 6** → **MySQL** (`DATABASE_URL`); Vitest can use `TEST_DATABASE_URL` |
| Offline | IndexedDB via **`idb`** |
| Scanning | **`@zxing/browser`** |
| 2FA | **`otplib`** + **`qrcode`** |
| Mail | **nodemailer** |
| Catalog import | **xlsx** |

> **Note on Next.js:** This repo’s `AGENTS.md` warns that Next.js 16 conventions may differ from older training data. Prefer guides under `node_modules/next/dist/docs/` when changing framework-level behavior.

---

## 3. Repository layout

```
src/
  app/                 # Routes, layouts, globals.css, api/* BFF handlers, auth/callback
  components/          # ui/ primitives · features/{auth,scan,device,classification,…}
  services/            # Domain services (resolve, inventory, dispatch, auth/totp, …)
  interfaces/          # Shared DTOs (client + server)
  lib/                 # GS1 parser, session, crypto, env, offline queue, http client, errors
  store/               # Zustand stores
  constants/           # Permissions, session TTL, auth routes
  schemas/             # Zod request schemas
prisma/                # schema.prisma, migrations, seed.ts
tests/                 # Vitest unit + integration
e2e/                   # Playwright
docs/                  # This documentation
```

Server logic lives in `services/` and `app/api/*`. The UI talks to the BFF via `lib/http/apiClient` (never directly to Prisma from the browser).

---

## 4. Domain model

Primary entities (see `prisma/schema.prisma`):

### Tenant & org structure

- **Tenant** — isolation boundary for users, sites, instances, captures, requests, dispatch targets, OXID connection.
- **Site** / **Area** — location hierarchy used when filing requests and inventarizing devices.
- **User** — email/password account, role string, optional TOTP fields (`totpEnabled`, encrypted secret, backup codes, verified-at).

### Device identity (model vs unit)

| Concept | Meaning |
|---|---|
| **DeviceModel** | Article master (GTIN / UDI-DI, manufacturer, trade/model name, EMDN/GMDN). Source: `manual` \| `catalog` \| `beudamed`. State: `draft` \| `review` \| `released`. |
| **DeviceInstance** | One physical unit in a tenant’s inventory. Unique `(tenantId, inventoryNumber)`. Optional serial. Links to a model and optionally an area/room. |
| **CapturedArticle** | Stage-4 unknown device (nameplate photo required). Forced `serviceOnly: true` — no spare-parts path. |

**Important (FA-102):** Catalog and BEUDAMED resolution return a **model only**. They never create a `DeviceInstance`. Units enter inventory via inventarize (`POST /api/devices`) or admin inventory flows.

**Uniqueness rules (practical):**

- UDI-DI / GTIN identify the **model**, not a single unit.
- **Inventarnummer** (`INV-#####`) identifies the unit within the tenant.
- **Serial number** (GS1 AI 21 when present) distinguishes units of the same model; inventarize requires serial and rejects duplicates for the same `(tenant, modelId, serial)`.

### Requests & dispatch

- **ServiceRequest** — idempotent create (`idempotencyKey` + `fingerprint`); subject is `instance` \| `model` \| `captured`; status events + attachments + dispatch records.
- **OrderRequest** — spare-parts order (separate lifecycle; approval defaults to `pending_approval`).
- **DispatchTarget** / **DispatchRecord** — per-tenant targets (`mail`, `oxid`, `webhook`) and per-send outcomes.
- **Classification** rules & proposals — drive service-type suggestions.
- **ExternalSourceRecord** — BEUDAMED (and similar) cache entries.
- **TenantOxidConnection** — OAuth tokens for the linked OXID shop (server-side only).
- **TotpChallenge** — short-lived login challenge between password success and session issue.

---

## 5. Application screens

| Route | Purpose |
|---|---|
| `/` | Scanner / resolve / request workflow (home) |
| `/login` | Email + password (+ TOTP step when enabled) |
| `/devices` | Inventory list & detail |
| `/catalog`, `/catalog/[id]` | Device model catalog |
| `/requests` | Service / order request list |
| `/users` | User administration |
| `/locations` | Sites and areas |
| `/roles` | Static role catalog (Phase A) |
| `/security` | Enroll / disable TOTP (QR + backup codes) |
| `/settings` | Tenant settings (incl. OXID shop link) |
| `/auth/callback` | OXID OAuth2 callback (route handler) |

Layouts: root, `(app)` (authenticated shell), `(auth)`.

Capturers with role `user` have no sidebar (`shell:nav`) but can use home (`/`) and `/security`.

---

## 6. API surface

Route handlers under `src/app/api/`:

### Auth & session

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/login` | Email/password; may return TOTP challenge instead of session |
| `POST` | `/api/auth/logout` | Clears session |
| `GET` | `/api/auth/session` | Current session |
| `POST` | `/api/auth/2fa/setup` | Start TOTP enrollment (secret + QR) |
| `POST` | `/api/auth/2fa/verify` | Confirm enrollment **or** complete login challenge |
| `GET` | `/api/auth/2fa/status` | Whether 2FA is enabled |
| `POST` | `/api/auth/2fa/disable` | Disable with password (+ code/backup) |

### Resolve & capture

| Method | Path |
|---|---|
| `POST` | `/api/resolve` |
| `POST` | `/api/captures` |
| `GET` | `/api/beudamed/[udiDi]` |

### Inventory & catalog

| Method | Path |
|---|---|
| `GET`/`POST` | `/api/devices` |
| `GET`/`PATCH` | `/api/devices/[id]` |
| `GET`/`POST` | `/api/catalog/models` |
| `GET`/`PATCH` | `/api/catalog/models/[id]` |
| `POST` | `/api/catalog/models/import` |

### Requests

| Method | Path |
|---|---|
| `GET`/`POST` | `/api/service-requests` |
| `GET` | `/api/service-requests/[reference]` |
| `POST` | `/api/service-requests/[reference]/status` |
| `POST` | `/api/service-requests/[reference]/transition` |
| `GET`/`POST` | `/api/order-requests` |
| `GET` | `/api/attachments/[id]` |

### Admin / settings / ops

| Method | Path |
|---|---|
| `GET` | `/api/me/capabilities` |
| `GET`/`POST` | `/api/users` (+ `[id]`, reset-password) |
| `GET` | `/api/roles` |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/sites` |
| `GET`/`POST`/`DELETE` | `/api/settings/oxid` |
| `GET`/`POST` | `/api/oxid/token`, `GET` `/api/oxid/categories` |
| `GET` | `/api/health` |

---

## 7. Device resolution pipeline

Entry: **`POST /api/resolve`** → `src/services/resolve/resolveService.ts`.

Identifiers are normalized by the GS1 / inventory parser (`src/lib/gs1`). Examples: plain inventarnummer, numeric GTIN, or GS1 AI string `(01)…(21)…`.

```
Scan / manual entry
        │
        ▼
┌───────────────────┐
│ 1. Inventory      │  Tenant DeviceInstance by inventory # / serial / GTIN
└─────────┬─────────┘
          │ miss
          ▼
┌───────────────────┐
│ 2. Catalog        │  Local DeviceModel, then OXID CatalogSearchAdapter
└─────────┬─────────┘
          │ miss
          ▼
┌───────────────────┐
│ 3. BEUDAMED       │  Cached ExternalSourceRecord; timeout + rate limits
└─────────┬─────────┘  Hit → persist DeviceModel (typically review)
          │ miss / soft-fail
          ▼
┌───────────────────┐
│ 4. Manual capture │  Client POST /api/captures (nameplate mandatory)
└───────────────────┘  serviceOnly forced server-side
```

### Stage behaviors

1. **Inventory** — unit found → instance + model; strongest path for service with inventarnummer/serial.
2. **Catalog** — model only (FA-102). No inventarnummer yet.
3. **BEUDAMED** — ~90-day cache; per-identifier and per-tenant rate limits; network/timeout failures are **swallowed** so the chain falls through to capture. Successful lookups can create/update a `DeviceModel` in `review`.
4. **Capture** — unknown device; UI state machine forbids `manual-capture → parts`.

Client UI state is driven by `scanStore` (resolving → classified → service-request / parts → success | queued).

---

## 8. Classification

`classificationService.decide()` is a **pure suggestion**:

- Rule priority: `basicUdiDi → emdn → gmdn → manufacturerModel`
- Tie-break: specificity → confidence → bounded validity → id
- **`verified`** proposals may pre-select a service type and **require** explicit confirmation (server returns 422 if confirmation is missing)
- **`derived`** / **`guess`** never pre-select; the full inspection list is still shown

Classification does not mutate inventory.

---

## 9. Service requests & spare-parts orders

### Service request create

`POST /api/service-requests`:

1. Validate payload (zod) and permissions.
2. **Idempotency:** same `(idempotencyKey, fingerprint)` → 200 with same reference; same key + different payload → 409; unique-constraint races handled.
3. One transaction: create request + `captured` status event + attachments.
4. Dispatch to configured targets (isolated per target).
5. Request becomes **`transmitted`** once at least one target succeeds.

Downstream systems can push status via `POST .../status`. Staff can transition open requests when permitted (`requests:transition`).

### Spare-parts orders

`POST /api/order-requests` — separate entity from service requests. Manual-capture subjects cannot order parts (`serviceOnly`).

### Client submit path

`useSubmitServiceRequest`:

- Online success → success UI (and optionally inventarize offer).
- Offline / network failure → enqueue with the **same** idempotency key.
- Business validation (422) → surface errors; do **not** queue.

---

## 10. Dispatch (mail / OXID / webhook)

`dispatchService` loads tenant `DispatchTarget`s and runs adapters by type:

| Type | Role |
|---|---|
| `mail` | Email via nodemailer / configured SMTP |
| `oxid` | Shop / ERP adapter (`mock` or `http`) |
| `webhook` | HTTP callback |

Failures on one target do not roll back others. Export content for mail is built in `serviceDispatchExport.ts`.

**Inventory subjects** include **Inventarnummer** and **Seriennummer** in plain-text and HTML email bodies when present. Catalog / capture subjects omit inventarnummer (none exists yet).

---

## 11. Post-request inventarize

After a **successful** service request whose resolve stage was **`catalog`** or **`beudamed`**, the success UI can offer inventarize (`buildInventarizeOffer` in `useSubmitServiceRequest`).

Not offered when:

- Subject was already an inventory instance, or
- Stage was manual capture (`captured`).

### Flow

1. User confirms serial (required), location/area/room, responsible person, commissioned year, etc. (`InventarizeForm` + Zod).
2. Client may pre-check duplicates via devices API.
3. `POST /api/devices` → `deviceInventoryService.create`.
4. Server allocates next tenant inventarnummer: **`INV-00001`**, **`INV-00002`**, … (`allocateInventoryNumber`).
5. Conflict if the same tenant already has that **serial for the same model**.

**Permissions:** `inventory:update` **or** `requests:create` (so capturers can inventarize after filing a request).

Inventarnummer is **not** entered by the user and must not be confused with UDI-DI.

---

## 12. Inventory & catalog

### Inventory (`/devices`, `/api/devices`)

- List / filter tenant `DeviceInstance`s.
- Create (inventarize or admin create) and patch metadata (location, responsible person, etc.).
- Lookup used by resolve stage 1 and by inventarize duplicate checks.

### Catalog (`/catalog`, `/api/catalog/models`)

- Browse / edit `DeviceModel` rows (permission `catalog:update` for writes — typically `superadmin` / `device_admin`).
- Import via XLSX (`POST .../import`).
- Stage 2 resolve also consults the OXID catalog adapter when local miss.

---

## 13. Authentication & session

### Staff login

Interactive staff auth is **email + password** (`SignIn.tsx` → `POST /api/auth/login`).

If the user has TOTP enabled, login returns a challenge and the UI asks for a 6-digit code (or backup code) before a session is issued (`POST /api/auth/2fa/verify`).

### Session cookie

- Name: `devicecare_session` (see `SESSION_COOKIE` / `src/lib/auth/session.ts`)
- Signed httpOnly cookie (HMAC with `SESSION_SECRET`)
- TTL: **12 hours**
- Tenant and user identity always derived from the cookie on the server

### Device PIN (client)

Optional **4-digit PIN** stored hashed in localStorage via `sessionStore`:

- Wrong PIN ×3 → force full sign-in
- Idle auto-lock after **5 minutes** (`IDLE_LOCK_MS`)
- Lock on tab hide (`useIdleTimer`)

PIN is a device UI lock, not a substitute for server auth.

### OXID OAuth

OXID OAuth2 + PKCE links a **tenant shop** (Settings → `/auth/callback`). Tokens stay server-side (`TenantOxidConnection`). Used for catalog/parts adapters — not the primary staff password login UI.

---

## 14. TOTP two-factor authentication

Implemented with `otplib` + `qrcode` and encrypted secrets at rest.

### Enrollment (`/security`)

1. Authenticated user starts setup → server generates secret, returns **otpauth URI** / QR.
2. User adds the account in an authenticator app (Google Authenticator, 1Password, Authy, etc.).
3. User confirms with a current 6-digit code → `totpEnabled` set; **backup codes** shown once.
4. Disable requires password + current code or backup code.

### Login challenge

1. Password OK + TOTP enabled → create `TotpChallenge` row + short-lived challenge cookie (no full session yet).
2. User submits code → verify TOTP window / backup code → delete challenge → issue session cookie.
3. Attempt limits and expiry prevent brute force.

### Crypto / config

- Secrets encrypted (AES-GCM) with `TOTP_ENCRYPTION_KEY` (falls back to `SESSION_SECRET` if unset).
- Issuer label: `TOTP_ISSUER` (default `DeviceCare`).

Permission slug: **`account:security`**. Path `/security` is reachable **without** `shell:nav` so capturers can manage their own 2FA.

---

## 15. Roles & permissions (RBAC)

Static map in `src/constants/permissions.ts` (Phase A — no per-user DB grants yet).

### Roles

| Role | Summary |
|---|---|
| `superadmin` | All permission slugs |
| `device_admin` | Service staff + `inventory:update` + `catalog:update` |
| `security_officer` | Service staff + `requests:view-all` |
| `user` | Inventory home + create request/parts + own requests + `/security`; **no** `shell:nav` |

### Permission slugs (catalog)

`shell:nav`, `inventory:view` / `update`, `catalog:view` / `update`, `requests:create`, `parts:request`, `requests:view-mine` / `view-open` / `view-all` / `transition`, `account:security`, `settings:view` / `oxid`, `users:*`, `locations:*`, `roles:view`.

### Path guard

`canAccessPath`:

- Always-allow paths (e.g. `/login`) pass.
- `/` needs `inventory:view` (works without sidebar).
- `/security` needs only `account:security`.
- Other app paths need `shell:nav` **plus** the path’s resource slug.

Capabilities are also exposed to the client via `GET /api/me/capabilities`.

---

## 16. Offline queue

`src/lib/offlineQueue.ts` + IndexedDB (`idb`) + `offlineQueueStore`.

- Queues **service-request** and **order-request** operations with downscaled photo attachments (≤ ~1600 px).
- Replay under a module-level mutex, preserving the original **idempotencyKey**.

| Response | Behavior |
|---|---|
| 2xx | Remove from queue |
| 409 | Mark synced (idempotent conflict treated as done) |
| 400 / 404 / 422 | Keep with error (needs user fix) |
| 5xx / network / 429 | Retry later |
| 401 / 403 | Stop replay; re-authenticate |

---

## 17. External adapters

OXID and BEUDAMED HTTP contracts were incomplete at build time; integrations sit behind interfaces and mode switches.

| Env | Modes |
|---|---|
| `OXID_ADAPTER_MODE` | `mock` — fixtures, dispatch succeeds; `http` — real adapter (fails closed until endpoints filled) |
| `BEUDAMED_ADAPTER_MODE` | `stub` — never calls out; `mock` — fixture GTIN; `http` — live API |

Wiring real systems should only require filling HTTP adapters + `.env` OAuth/API values; routes, UI, and most tests stay unchanged.

---

## 18. Security practices

- Tenant always from session — strip/ignore client `tenantId` on sensitive schemas.
- httpOnly signed session cookie; OXID tokens never sent to the browser.
- TOTP secrets encrypted at rest; backup codes hashed.
- Error responses omit stack traces in production paths.
- External calls log hashed identifiers + correlation ids where applicable.
- Optional device PIN lock + idle timeout on the client.
- RBAC enforced in RouteGuard (UI) and API handlers (server).

---

## 19. Configuration (env)

See `.env.example`. Important variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma MySQL connection string |
| `TEST_DATABASE_URL` | Optional isolated MySQL DB for Vitest |
| `SESSION_SECRET` | Sign session cookie (`openssl rand -hex 32`) |
| `TOTP_ENCRYPTION_KEY` | Encrypt TOTP secrets (optional; defaults to session secret) |
| `TOTP_ISSUER` | Authenticator account label (default `DeviceCare`) |
| `OXID_*` | OAuth client, authorize/token URLs, API base, redirect, scope, adapter mode |
| `BEUDAMED_*` | API base/key, cache TTL, timeout, rate limits, adapter mode |
| `SMTP_*` | Optional platform mail fallback (`SMTP_HOST`, `SMTP_FROM`, …) |
| `PLAYWRIGHT_BASE_URL` | Point e2e at a running server |

---

## 20. Local development

```bash
npm install
cp .env.example .env          # set DATABASE_URL to your MySQL instance
npx prisma migrate deploy
npm run db:seed
npm run dev                   # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (MySQL via `DATABASE_URL` or `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright (install Chromium once) |
| `npm run db:studio` | Prisma Studio |

---

## 21. Testing

- **Unit / integration:** Vitest under `tests/` and colocated `*.test.ts` — services, schemas, permissions, dispatch export, GS1, etc.
- **E2E:** Playwright phone + tablet profiles; e2e injects a signed session cookie (`e2e/auth.ts`) rather than driving OXID OAuth.

---

## 22. Seed data & demo identifiers

`prisma/seed.ts` is idempotent and exports `SEED` ids used by tests:

- Tenant `demo-tenant`
- Sites Bonn / Cologne with areas
- Device models + inventory instances (`INV-10001`, `INV-10002`)
- Classification rules (verified + derived)
- Dispatch targets (mail + OXID)

Try these identifiers after seed:

| Input | Expected stage |
|---|---|
| `INV-10001` | Inventory — verified classification path |
| `(01)04012345678918(21)SN-777` | Catalog (model + serial in identifier) |
| `04012345678949` | BEUDAMED when `BEUDAMED_ADAPTER_MODE=mock` |
| `04012345678956` | Unknown → manual capture |

---

## Related reading

- Root [`README.md`](../README.md) — quick start and high-level architecture
- `prisma/schema.prisma` — authoritative data model
- `src/constants/permissions.ts` — Phase A RBAC map
- `src/services/resolve/resolveService.ts` — resolution chain
- `src/services/auth/totpService.ts` — 2FA lifecycle
- `src/services/inventory/deviceInventoryService.ts` — inventarnummer allocation & inventarize create
