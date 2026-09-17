# DeviceCare

Mobile-first web app for clinical technicians and nursing staff: scan a medical device, identify it through a four-stage resolution chain, get a classification *suggestion*, and raise a service request or spare-parts order — online or offline.

Built from `DeviceCare_Implementation_Guide_Continued.md`. Next.js 16 (App Router, Route Handlers as BFF) · React 19 · TypeScript · Tailwind v4 · Zustand · Prisma · IndexedDB (`idb`) · `@zxing/browser` · zod.

## Quick start

```bash
npm install
cp .env.example .env          # defaults work out of the box (SQLite, mock adapters)
npm run db:migrate            # creates prisma/dev.db from the migrations
npm run db:seed               # deterministic demo data (see below)
npm run dev                   # http://localhost:3000
```

Sign in with **OXID OAuth2 + PKCE** (configure `OXID_CLIENT_ID`, `OXID_AUTHORIZE_URL`, `OXID_TOKEN_URL` in `.env`), optionally set a 4-digit device PIN, then enter an identifier via **Enter manually** or point the camera at a barcode.

Identifiers worth trying:

| Input | What happens |
|---|---|
| `INV-10001` | Stage 1 — inventory hit (Infusion Pump X200, Bonn ICU Room 4), **verified** proposal → STK pre-selected, confirmation required |
| `(01)04012345678918(21)SN-777` | Stage 2 — catalog hit (Patient Monitor M10), **derived** proposal → nothing pre-selected |
| `04012345678949` | Stage 3 — BEUDAMED (only with `BEUDAMED_ADAPTER_MODE=mock`), persisted into the device master in `review` state |
| `04012345678956` | Stage 4 — unknown → manual capture (nameplate photo mandatory, service-only) |

## Database: SQLite now, MySQL later

Prisma currently points at a local file (`DATABASE_URL="file:./dev.db"`). The schema deliberately uses only column types that exist on both providers (JSON is stored as text, no native-type annotations), so switching is a three-step change:

1. `prisma/schema.prisma`: `provider = "sqlite"` → `provider = "mysql"`
2. `.env`: `DATABASE_URL="mysql://user:password@host:3306/devicecare"`
3. Regenerate the migration history for MySQL against the empty database:
   `rm -rf prisma/migrations && npx prisma migrate dev --name init && npm run db:seed`

(SQLite migration SQL is not portable, hence the fresh `init` migration.)

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve the build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next + React Compiler rules) |
| `npm test` | Vitest unit + integration tests (uses an isolated `prisma/test.db`, seeded in-process) |
| `npm run test:e2e` | Playwright (phone + tablet Chromium profiles). First run: `npx playwright install chromium`. Set `PLAYWRIGHT_BASE_URL` to reuse a running server. |
| `npm run db:migrate` / `db:generate` / `db:seed` / `db:studio` | Prisma helpers |

Interactive auth is **OXID only**. Playwright injects a signed session cookie for e2e (see `e2e/auth.ts`).

## Architecture

```
src/
  app/            layout, page, globals.css (design tokens), api/* route handlers, auth/callback
  components/     ui/ primitives · features/{auth,scan,device,classification,location,service-request,cart,log} · App.tsx shell
  services/       resolveService (4-stage chain), classificationService, serviceRequestService, orderRequestService,
                  dispatchService (registry), beudamedService (cache/timeout/rate limit), captureService, oxidAuthService,
                  adapters/ (oxid mock+http, beudamed stub/mock/http, mail/webhook dispatch)
  interfaces/     DTOs shared by server and client
  lib/            gs1 parser, validation (zod), auth/session + tenantContext, crypto, errors, logger, idb + offlineQueue, image
  store/          zustand: scanStore (UI state machine), requestStore, sessionStore (PIN), offlineQueueStore, logStore, toastStore
prisma/           schema, migrations, seed.ts (exports SEED ids + seed())
tests/            vitest setup/globalSetup + integration tests · e2e/ Playwright specs
```

### Resolution chain (`POST /api/resolve`)

1. **Inventory** — tenant-scoped `DeviceInstance` by inventory number / serial / GTIN.
2. **Catalog** — local `DeviceModel`, then the `CatalogSearchAdapter` (OXID).
3. **BEUDAMED** — 90-day `ExternalSourceRecord` cache, 2 s timeout, per-identifier (1/h) and per-tenant (200/day) rate limits; any failure is swallowed and falls through. Hits are persisted as `DeviceModel` in `review` state.
4. **Manual capture** — `POST /api/captures`; `serviceOnly: true` is forced server-side and the UI state machine forbids `manual-capture → parts`.

### Classification is a suggestion

`classificationService.decide()` is a pure function: rule priority `basicUdiDi → emdn → gmdn → manufacturerModel`, tie-break by specificity → confidence → bounded validity → id. `verified` proposals pre-select and **require** confirmation (server returns 422 otherwise); `derived`/`guess` never pre-select. The full inspection list is always rendered.

### Service requests

`POST /api/service-requests` is idempotent: `(idempotencyKey, fingerprint)` → identical retry returns 200 with the same reference, a different payload under the same key returns 409, and the unique-constraint race is handled. Creation, the `captured` status event and attachments are one transaction; dispatch then runs per target (mail / OXID / webhook) with per-target isolation — the request becomes `transmitted` once at least one target succeeds. `POST /api/service-requests/:reference/status` accepts downstream status feedback.

### Offline

Requests made offline (or after a network failure) are queued in IndexedDB with their downscaled photos (≤ 1600 px) and replayed by `replayQueue` under a module-level mutex. Replay rules: 2xx remove · 409 mark synced · 400/404/422 keep with error · 5xx/network retry later · 401/403 stop and re-authenticate.

### Security

Signed httpOnly session cookie; the tenant always comes from the session, never from a request body. OXID sign-in uses OAuth2 + PKCE with tokens kept server-side. Optional device PIN with a three-attempt lockout and idle auto-lock. Error responses never include stack traces; external calls are logged with hashed identifiers and correlation ids.

## Adapter modes — ⚠ pending API specifications

The OXID and BEUDAMED HTTP contracts were **not** available when this was built, and the guide forbids guessing them. Everything that touches them sits behind an interface and a mode switch:

| Env | `mock` | `stub` | `http` |
|---|---|---|---|
| `OXID_ADAPTER_MODE` | in-repo catalog/parts fixture, dispatch always succeeds | — | `adapters/oxidHttpAdapter.ts` — fails closed until the endpoints are filled in |
| `BEUDAMED_ADAPTER_MODE` | fixture for GTIN `04012345678949` | never calls out (stage 3 always misses) | `adapters/beudamedAdapters.ts#beudamedHttpLookup` — placeholder |

To integrate the real systems, fill in the `http` adapters (request/response mapping only) and the OXID OAuth endpoints in `.env`; routes, services, UI and tests need no changes.

## Seed data

`prisma/seed.ts` is idempotent (upserts) and exports the `SEED` ids used by the tests: one tenant (`demo-tenant`), two sites (Bonn, Cologne) with areas, three device models, two inventory instances (`INV-10001`, `INV-10002`), two classification rules (one verified, one derived), and two dispatch targets (mail + OXID).
