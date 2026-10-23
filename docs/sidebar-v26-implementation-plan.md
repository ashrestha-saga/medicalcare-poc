# Sidebar v26 + nav counts + §14 export — sequenced plan

**Sources:** André briefs 23 Oct 2026 (`devicecare-dev-task-sidebar-counts-export-14-en.md`, `devicecare-backoffice-sidebar-ux-analyse-v1.md`) · current POC nav (`MENU_MODULES`, `AppShell`)  
**Related:** [`demo-seed-coverage.md`](./demo-seed-coverage.md), [`SCHEMA_AND_ARCHITECTURE.md`](./SCHEMA_AND_ARCHITECTURE.md)

**Principle:** Ship **backend contracts first** (counts, export), then **IA/shell**. Prefer **v26 count rules** once E11 is locked; don’t implement v25 “Bestand = 300” and v26 “Bestand = open issues” at the same time.

---

## 0 · Decisions (locked + open)

| ID | Question | Decision |
|----|----------|----------|
| **Dashboard / dash** | Clinic sidebar home | **Locked:** Existing **Dashboard** stays as-is (this *is* the mockup “Heute”). **Label remains “Dashboard”** — no rename, no new route, no second surface. |
| **Verwaltung extras** | `roles`, `activity` | **Locked:** Put **`roles`** and **`activity`** inside **Verwaltung**, group **aufgeklappt** (expanded by default). |
| **Settings / security** | Account security | **Locked:** Keep **`settings`** in the secondary rail as today; place **`security`** **inside Settings** (not a separate Verwaltung nav item). |
| **E11** (replaces E10) | Bestand sidebar tag | **Locked (implemented):** **(A)** open Klärfälle / Klärliste devices only |
| **Labels** | DE nav copy | Use v26 names only where entries are renamed; **do not** relabel Dashboard → Heute |
| **duty-overlap** | Placement | Under **Geräte** or Verwaltung — confirm in P3 |

**Exit for counters:** E11 only. Dashboard + Verwaltung / Settings placement are decided — implement accordingly in P3.

---

## Phase overview

```
P0 Decisions
    ↓
P1 Nav-counts API (+ thin badge UI on current nav)
    ↓
P2 Export §14 (CSV → PDF → ExportLog)
    ↓
P3 IA shell v26 (groups, tabs, collapse, labels)
    ↓
P4 ⌘K search + Erstanlage chip + Betreuung banner
    ↓
P5 Mobile bottom bar + polish / acceptance vs seed
```

Each phase is a reviewable PR (or small PR set). Do not start P3 until P1 returns the keys the new shell will read.

---

## Phase 1 — Nav counts API + badges on current shell

**Goal:** One server aggregate; sidebar shows count/warn; no IA redesign yet.

### 1.1 API
- Route: `GET /api/nav/counts` (prefer session tenant over path `{tenantId}` — matches existing BFF style)  
  Alternate path shape if required by brief: `/api/tenants/[tenantId]/nav-counts` with ownership check.
- Response shape (stable keys = mockup `k`):

```json
{
  "dash": { "count": null, "warn": false },
  "list": { "count": 52, "warn": true },
  "faelligkeiten": { "count": 45, "warn": true, "mode": "overdue" },
  "models": { "count": null, "warn": true, "mark": "!" },
  "…"
}
```

- **v26 counting rules (post-E11):**

| Key | Count | Warn |
|-----|-------|------|
| `dash` / Dashboard | existing dashboard tile/open-action count if already available; else `null` (no new engine; no Heute rename) | > 0 if count set |
| `list` (Bestand) | open Klärliste devices (A3) | > 0 |
| `faelligkeiten` | overdue if any, else due total | overdue |
| `auftraege` | open SRs | optional |
| `aufbnachweis` | routine open today + unreleased batches | batch open |
| `konstanztakt` | objects without cadence | > 0 |
| `schulungen` | **fällige** only | > 0 |
| `vorkommnisse` / `rueckrufe` / `begehung` | as Task A | as A |
| `models` | no number; `mark: "!"` if unconfirmed Einstufung | mark |
| `traegerschaft` | duties without carrier | > 0 |
| `issues`, `export`, `personen`, `sites` | omit from menu later; may still return for diagnostics | — |

- Role scoping: omit keys the user cannot open (same slugs as `MENU_MODULES`).
- Cache ~30s per `(tenantId, userId|role)`; invalidate on relevant writes (start with short TTL only if invalidation is heavy).

### 1.2 Klärliste rules (A3) — map to schema
Implement in a pure helper `src/services/nav/klarlisteIssues.ts`:

| Issue | POC field |
|-------|-----------|
| typ | `typeDesignation` / product kind empty |
| id | no `serialNumber` and no `udiDi` |
| resp | no `responsibleUserId` |
| cls | no open `DeviceModelClassification` |
| clsconf | open classification `confidence === derived` |
| kl-* | open `DeviceClarification` |
| nw-* | missing evidence where modelled |
| dup | same tenant + same serial, non-retired |

Count **devices**, not issues.

### 1.3 UI (minimal)
- Extend `NavLink` in `AppShell` with optional `count` / `warn` / `mark`.
- Fetch counts in `PermissionProvider` or a small `useNavCounts` hook; refresh after known mutations (devices, duties, …) or on focus + 30s.

### 1.4 Acceptance
- T-KLN (or live tenant): tags match SQL/script for Klärliste, Fälligkeiten, sites, open SRs.
- Switching tenant refreshes counts.
- No spinner inside tags; skeleton once then numbers.

**Files (touch):** `src/app/api/nav/counts/route.ts`, `src/services/nav/*`, `AppShell.tsx`, `messages/*` (aria-labels), tests under `src/services/nav/*.test.ts`.

---

## Phase 2 — Export §14

**Goal:** Real CSV/PDF of released inventory + audit of the file.

### 2.1 Schema
- Add `ExportLog` (tenantId, userId, format, filters JSON, rowCount, sha256, createdAt, optional blobId/path).
- Migration + tenant guard list.

### 2.2 API
- `GET /api/inventory/export?format=csv|pdf&siteId=&areaId=`
- Auth: clinic roles with export right (map to `inventory:view` + role check, or new `inventory:export` slug — prefer **explicit slug** seeded for superadmin / device_admin / security_officer).
- Partner → 403.
- Rows: `DeviceInstance.state === released` only; columns per Task B3.
- CSV: UTF-8 BOM, `;`, CRLF, DE headers.
- PDF: A4 landscape, header/footer per B4 (library TBD: e.g. `pdfkit` / `@react-pdf`).
- Async job only if row count > 2000 (defer if seed parks stay &lt; 2k released per tenant).

### 2.3 UI
- Button on `/devices` toolbar: “Export §14”.
- Wire dashboard tile `bestandsverzeichnis` to export flow (or devices + open export dialog), not only `?state=released`.
- “Zuletzt exportiert” list from `ExportLog` (last 5).

### 2.4 Audit
- Always write `ExportLog` + optional `AuditEvent` (`resource: inventory_export`).

### 2.5 Acceptance
- CSV opens in Excel DE; row count = released count.
- T-MVZ admin cannot export T-KLN; partner 403.
- Retire device → next export shrinks.

**Files:** `prisma/schema.prisma`, `src/services/inventory/inventoryExportService.ts`, `src/app/api/inventory/export/route.ts`, Devices toolbar, dashboard tile link.

---

## Phase 3 — IA / shell v26

**Goal:** New grouping and labels; Klärliste as tab; Verwaltung collapsible.

### 3.1 Menu model
- Refactor `MENU_MODULES` / `MenuGroupId`:
  - Top: **Dashboard** — **unchanged** (href, label, behaviour; mockup “Heute” maps here)
  - **Geräte:** Bestand, Fälligkeiten, Aufträge (+ duty-overlap?)
  - **Nachweise:** MP-Buch, Aufbereitung, Strahlenschutz, Schulungen
  - **Meldungen:** Vorkommnisse, Rückrufe, Behördenbegehung
  - **Verwaltung** (**aufgeklappt** by default): Standorte, Personen, Modellkatalog, Dienstleister & Verträge, Zuständigkeiten (if any), **`roles`**, **`activity`**
- **Secondary rail:** **`settings`** as today (with logout). **`security`** lives **inside Settings** (settings screen section / sub-route), not as its own Verwaltung or secondary nav row.
- Remove primary nav: Erstanlage (→ chip P4), Export, standalone Klärliste.
- Keep `k` / `id` stable where possible for counts mapping (`list`, `faelligkeiten`, …).

### 3.2 Klärliste → Bestand tab
- `/devices?tab=all|klaerliste|released|retired` (or equivalent).
- Deep link from old `/clarifications` → redirect to `?tab=klaerliste`.
- Bestand badge uses Phase 1 `list` count.

### 3.3 Verwaltung
- **Default: expanded (aufgeklappt)** so roles / activity stay visible without an extra click.
- Optional: allow user collapse later; if collapsed, roll up warn marks onto the group header.
- Settings (+ security inside it) stay outside this group.

### 3.4 i18n
- Update `nav.*` + group keys in `messages/en.json` / `de.json`.

**Files:** `permissions.ts`, `interfaces/permissions.ts`, `AppShell.tsx`, `DevicesScreen` / clarifications redirect, messages.

---

## Phase 4 — Search, Erstanlage chip, Betreuung banner

### 4.1 ⌘K search
- `GET /api/search?q=` — inventory #, serial, UDI, room, person name, model trade name; tenant-scoped; limit ~20.
- Command palette component (⌘K / Ctrl+K); Enter → device detail or person.
- Tablet: same entry as scan affordance if desired.

### 4.2 Erstanlage progress
- Define `setupSteps` (checklist: sites, MPSB, first released device, …) — product list with André.
- API: `GET /api/setup/progress` → `{ done, total, steps[] }`.
- Chip above nav; hide when complete; “Einrichtung erneut öffnen” under Verwaltung › Dienstleister.

### 4.3 Betreuung / Sperre banner
- Schema or settings flag for provider block (e.g. on `ServiceContract` or tenant ops flag — **new field**; not present today).
- Banner under nav + optional header; invalidate nav-counts `betreuung` mark.

---

## Phase 5 — Mobile + acceptance

- &lt;900px: bottom bar Dashboard · Geräte · Nachweise · Meldungen · Mehr (Verwaltung + rest).
- Screenshot acceptance vs UX table (§5).
- Re-run count script against live DB (don’t rely on seed A6 fixed “300”).
- Partner console unchanged (no clinic sidebar).

---

## Explicit non-goals (this epic)

- Tenant-scoped `DeviceModelClassification` (separate).
- Partner console nav redesign.
- Replacing `AuditEvent` / Activity with `ExportLog` (keep both; see prior Q&A).
- Full tree-test execution (process; not code).

---

## Dependency / risk register

| Risk | Mitigation |
|------|------------|
| E11 undecided | Phase 1 returns both `list.total` and `list.issues` temporarily; UI binds one field after decision |
| Klärliste rules incomplete (evidence) | Ship first five A3 rules; log pending |
| PDF fonts / CD | CSV first PR; PDF follow-up |
| Count query cost on 5k models | Global `models` warn = existence query (`LIMIT 1` missing confirmed), not full scan in hot path |
| Nav key drift | Single map `NavCountKey` ↔ `MenuModule.id` in `src/constants/navCounts.ts` |

---

## Suggested PR sequence (concrete)

| PR | Title | Phase |
|----|-------|-------|
| 1 | `feat(nav): nav-counts API + Klarliste helper` | 1.1–1.2 |
| 2 | `feat(nav): sidebar count badges` | 1.3 |
| 3 | `feat(inventory): §14 CSV export + ExportLog` | 2 |
| 4 | `feat(inventory): §14 PDF + last exports UI` | 2 |
| 5 | `feat(nav): v26 groups; Verwaltung with roles/activity; security under Settings` | 3 |
| 6 | `feat(devices): Klarliste tab + redirect` | 3 |
| 7 | `feat(nav): command palette search` | 4 |
| 8 | `feat(nav): setup progress chip + block banner` | 4 |
| 9 | `feat(nav): mobile bottom bar` | 5 |

---

## First week checklist

1. Lock **E11** with André (Dashboard + Verwaltung / Settings already locked).  
2. Implement Klarliste helper + unit tests on seed JSON / fixtures.  
3. Ship PR1–2 (counts visible on **current** 8-group nav).  
4. Start Export CSV (PR3) in parallel if two people.  
5. P3: Dashboard unchanged; Verwaltung aufgeklappt includes roles + activity; security under Settings; settings secondary as today.

---

## Mapping: mockup key → POC route (today)

| Key | POC href (today) | v26 home |
|-----|------------------|----------|
| dash | `/dashboard` (as today) | **Dashboard** (unchanged; mockup “Heute”) |
| list / issues | `/devices`, `/clarifications` | `/devices?tab=…` |
| faelligkeiten | `/due-dates` | same |
| auftraege | `/requests` | same |
| mpbuch | `/device-book` | Nachweise |
| aufbnachweis | `/reprocessing` | Nachweise · Aufbereitung |
| konstanztakt | `/constancy-cadence` | Nachweise · Strahlenschutz |
| schulungen | `/training` | Nachweise |
| vorkommnisse | `/incidents` | Meldungen |
| rueckrufe | `/field-safety` | Meldungen |
| begehung | `/authority` | Meldungen |
| sites | `/locations` | Verwaltung |
| personen | `/users` | Verwaltung |
| models | `/catalog` | Verwaltung |
| betreuung | `/management` | Dienstleister & Verträge |
| traegerschaft | (gap / dashboard assignments) | Zuständigkeiten — may need `/dashboard/assignments` or new page |
| export | — | Bestand toolbar |
| erstanlage | `/registration` | chip |

**Gap:** “Zuständigkeiten / Trägerschaft” has no dedicated page equal to mockup — confirm whether `/dashboard/assignments` is enough before P3.
