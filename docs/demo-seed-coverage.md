# DeviceCare demo seed — coverage, gaps & schema map

**Seed pack:** `seed/` in this repo (generated seed `20261014`, enhanced 22 Oct 2026 with process layer)  
**Target schema:** live `prisma/schema.prisma`  
**Companion app seed:** `prisma/seed.ts` (+ Ref*, partner, Prüfpartner) — required before this pack  

This document describes:

1. What the demo seed loads and how entities connect  
2. What is missing for full multi-tenant SaaS feature testing  
3. Example rows and the **runtime effect** of having vs lacking them  

Pack path: [`seed/README.md`](../seed/README.md) · generator `seed/gen_seed.py` · process slice `seed/process_layer.py` · importer `seed/import_seed.ts`.

---

## 1. Design intent of the demo seed

| Principle | Meaning |
|-----------|---------|
| **Shared catalogue** | `DeviceModel` (+ open `DeviceModelClassification`) has **no `tenantId`** |
| **Tenant inventory** | Sites, areas, users, instances are keyed by `tenantCode` |
| **No process freeze** | No `DeviceReleaseSnapshot` / `DeviceDuty` — those come from Erstanlage **release** (C1) |
| **Refs external** | `RefRuleSet`, Annex 2, product kinds, Prüfpartner catalogues must already exist |

**Four tenants**

| Code | Operator | Model | Sites · areas | Users | Devices | Demo focus |
|------|----------|-------|---------------|-------|---------|------------|
| T-KLN | Klinikum Nord, Bonn | institution_operated | 4 · 26 | 60 | 300 | Full hospital + 11 mockup devices |
| T-MVZ | MVZ Rheinbogen, Köln | provider_operated | 2 · 10 | 12 | 70 | Care centre (needs partner contract for acting) |
| T-HZF | Hautzentrum (3 physicians) | institution_operated | 1 · 9 | 9 | 48 | Role split + lasers / IPL / UV |
| T-RSG | Reha-Klinik Siebengebirge | provider_operated | 1 · 10 | 20 | 110 | Rehab park (needs partner contract) |

---

## 2. What the seed **does** load

| File | Rows | Prisma model(s) | Natural key | Tenant? |
|------|------|-----------------|-------------|---------|
| `tenants` | 4 | `Tenant` | `code` | — |
| `sites` | 8 | `Site` | `tenantCode` + `code` | yes |
| `areas` | 55 | `Area` | `key` = `tenant/site/area` | yes |
| `users` | 101 | `User` + `PersonQualification` + `UserPermission` | `email` | yes |
| `safety_officer_appointments` | 8 | `SafetyOfficerAppointment` | tenant + site + person | yes |
| `device_models` | 5 000 | `DeviceModel` + 1 open `DeviceModelClassification` each | `basicUdiDi` | **no** |
| `device_instances` | 528 | `DeviceInstance` | `tenantCode` + `inventoryNumber` | yes |
| `release_snapshots` | 115 | `DeviceReleaseSnapshot` | tenant + inventory | yes |
| `device_duties` | ~155 | `DeviceDuty` | snapshot + dutyKey | yes |
| `service_requests` | 12 | `ServiceRequest` | `reference` | yes |
| `organisations` / `partner_users` / `service_contracts` | 2 / 3 / 4 | Partner graph | org `code` | partner |
| `clarifications` / `training_events` / `incidents` | 8 / 4 / 2 | Sparse process | — | yes |

**Kennzahlen (summary):** 4306 models released · …; 415 instances released · 76 maintenance-overdue; **115 freezes · ~155 duties · 12 SRs · 4 partner contracts**. Product kinds map to live Ref codes (`aktiv-therapie`, `messgeraet`, …).

---

## 3. Entity relationship (seeded vs not)

```
                    ┌─────────────────────────────────────────┐
   GLOBAL / SHARED  │  DeviceModel ── DeviceModelClassification │  ← SEEDED (5k + 5k opens)
                    │       │                                   │
                    └───────┼───────────────────────────────────┘
                            │ modelId
┌───────────────────────────┼──────────────────────────────────────────────┐
│ TENANT                    ▼                                              │
│ Tenant ─┬─ Site ─ Area ── DeviceInstance  ← SEEDED                       │
│         │                    │                                           │
│         │                    ├─ DeviceReleaseSnapshot  ✗ NOT SEEDED      │
│         │                    ├─ DeviceDuty ─ DutyPerformance  ✗          │
│         │                    ├─ DeviceEvidence / Clarification  ✗        │
│         │                    ├─ MaintenanceEvent  ✗                      │
│         │                    ├─ InspectionRun / Baseline  ✗              │
│         │                    ├─ Reprocessing*  ✗                         │
│         │                    └─ DeviceBookEntry / Incident  ✗            │
│         ├─ User ─ PersonQualification / UserPermission  ← SEEDED (thin)  │
│         ├─ SafetyOfficerAppointment  ← SEEDED                            │
│         ├─ ServiceRequest / OrderRequest / Dispatch*  ✗                  │
│         ├─ TrainingEvent / TrainingRecord  ✗                             │
│         ├─ FieldSafety* / Authority* / ConstancyCadence  ✗               │
│         └─ ServiceContract ──► Organisation (partner)  ✗ CRITICAL GAP    │
└──────────────────────────────────────────────────────────────────────────┘

Ref* (rule sets, Annex2, inspection catalogues, …)  ← app prisma/seed, NOT this pack
RoleGrant / AuditEvent / TotpChallenge / OxidConnection  ← not in this pack
```

See also the simplified ERD in [SCHEMA_AND_ARCHITECTURE.md](./SCHEMA_AND_ARCHITECTURE.md) §8.

---

## 4. Gap register — missing data for full SaaS testing

### 4.1 Critical (blocks whole product areas)

| Missing model(s) | Connects to | Effect if absent |
|------------------|-------------|------------------|
| **`InspectionRun`** / **`InspectionStepResult`** / **`BaselineMeasurement`** / **`TestEquipment`** | Device, catalogue, SR/duty | `/inspect` seal path still weak (equipment may exist from app seed) |
| ~~`ServiceContract` / partner orgs~~ | — | **Now seeded** (MSR/RTS + 4 contracts) — still need app Ref* + partner login door |
| ~~`DeviceReleaseSnapshot` / `DeviceDuty`~~ | — | **Now seeded** for a freeze subset (~115 instances) |
| ~~`ServiceRequest`~~ | — | **Now seeded** (12 from overdue duties; no full status timeline) |

### 4.2 Important (features exist but demos are hollow)

| Missing | Connects to | Effect |
|---------|-------------|--------|
| `DeviceEvidence` / `DeviceClarification` | Instance / prerequisites | Erstanlage gate demos only via live wizard |
| `ModelDocument` | Model + **tenant** | No per-clinic IFU/docs on shared models |
| `TrainingEvent` / `TrainingRecord` | Model, User | Training screens empty |
| `DeviceIncident` / `FieldSafetyAction*` | Model / instance / tenant | Incidents / FSCA UIs empty (some users have view perms) |
| `DeviceReprocessingProfile` / `ReprocessingOnDevice` / `ReprocessingBatch*` | Instance | AEMP / scan release demos weak (Sachkunde users exist) |
| `ConstancyCadence` | Duties / constancy objects | Constancy cadence screen empty |
| `CapturedArticle` | Resolve stage 4 | No pre-seeded unknown devices |
| `ExecutorOrg` / `DispatchTarget` / `DispatchOutbox` | SR dispatch | Mail/OXID/webhook demos need config + rows |
| `OrderRequest` / `OrderItem` | Parts path | Spare-parts queue empty |
| `AuthorityInspection` / findings | Compliance | Authority screens empty |
| `DutyOverlapDecision` / overlap refs | Duties | Overlap UI empty |
| `DashboardTileGrant` / `UserDashboardTile` | Users | Custom dashboards not pre-assigned |
| `TenantOxidConnection` / `SmtpSettings` | Tenant / org | Settings integrations not prewired |
| `TotpChallenge` / invitations / reset tokens | User | 2FA/invite only via live flows |
| `AuditEvent` | Tenant | Audit timeline empty until actions run |
| `ExternalSourceRecord` | Model | BEUDAMED cache not prefilled (resolve will fetch/create) |

### 4.3 Soft gaps inside what *is* seeded

| Issue | Effect |
|-------|--------|
| **Released instances without duties** | Look “live” in inventory but Pflichtkalender / due-dates / inspect-from-duty are empty until release/reclassify |
| **Global open classification** (`openClassificationKey = deviceModelId`) | One Einstufung for all tenants — multi-tenant reclassify isolation **not** representable |
| **`UserPermission` only ~8 slugs** | Most access comes from **role defaults** (`device_admin`, …), not the seed permission list |
| **`accountKind: clinic` only** | No partner users in this pack |
| **`pk-*` / `fam-*` codes** | Importer nulls unknown `RefProductKind` / `RefDeviceFamily` → family steps / kind filters degrade |
| **No `characteristicsJson`** | Wizard Merkmale blob only after live Erstanlage |
| **5 000 models vs 481 used** | Good catalog scale test; most models never appear in inventory |

---

## 5. Schema clusters — example data & effects

### 5.1 Tenancy & org structure

| Model | Example | Effect when present | When missing |
|-------|---------|---------------------|--------------|
| `Tenant` | `T-KLN` Klinikum Nord | Login scoped; all tenant rows filtered | No clinic context |
| `Site` | `BN-A` Haus A | Locations UI; MPSB/headcount gates | Erstanlage site rules fail |
| `Area` | `T-KLN/BN-A/Station 3B` | Device location; work-area filters | Inventory placement broken |
| `SafetyOfficerAppointment` | MPSB on site | Prerequisite for some releases | Gate may block Erstanlage |
| `SiteHeadcount` | *(not in pack)* | Same gate family | May block where required |

**Connection:** `Tenant` → `Site` → `Area` → `DeviceInstance.areaId`; users `homeAreaId` → `Area`.

---

### 5.2 Users, RBAC, qualifications

| Model | Example | Effect |
|-------|---------|--------|
| `User` | `device_admin` in T-HZF (Dr. Önal) | Catalog write, inventory, reclassify |
| `User` | `security_officer` (MPSB) | Incidents / oversight paths |
| `User` | `user` (floor) | Scan home, limited nav (`shell:nav` often absent) |
| `PersonQualification` | `sachkunde_aufbereitung` | Batch release allowed |
| `PersonQualification` | `fachkunde_strlsch` + `validUntil` | Radiation inspect gates |
| `UserPermission` | `devicebook:view`, `reprocessing:release`, … | Extra grants beyond role map |
| `RoleGrant` | *(app seed / UI)* | Runtime permission catalog |
| Partner `User` + `OrgMembership` | *(missing)* | Partner console login/acting |

**Connection:** `User.tenantId` → clinic; partner users hang off `Organisation` via membership, then `ServiceContract` → `Tenant`.

---

### 5.3 Shared catalogue & classification

| Model | Example | Effect |
|-------|---------|--------|
| `DeviceModel` | Infusion pump, `basicUdiDi` unique, `state=released`, `source=catalog` | Appears in `/catalog`; resolve stage 2/3 hit |
| `DeviceModel` | `state=draft` / `review` | Lifecycle / approval demos (if enforced) |
| `DeviceModelClassification` (open) | `stk=true`, `mtkItemNo=1.1`, `radiation`, `softwareClass`, `productKindCode` | Prefill Erstanlage; catalogue resolution; STK/MTK chips |
| Closed classification history | *(not generated — only one open)* | Reclassify history demos need live reclassify |
| `ExternalSourceRecord` | *(missing)* | BEUDAMED cache miss → live/adapter call |
| `ModelDocument` | *(missing)* | No tenant IFU attachments on model |

**Connection:**

- `DeviceModel` 1──* `DeviceModelClassification`
- `DeviceModel` 1──* `DeviceInstance` (per tenant)
- Open uniqueness today: `openClassificationKey = deviceModelId` (global)

**Multi-tenant note:** Classification is **shared**. Clinic A’s reclassify closes the single open row for everyone. Tenant-scoped classification is a product change, not covered by this seed.

---

### 5.4 Inventory units

| Model | Example | Effect |
|-------|---------|--------|
| `DeviceInstance` released | INV-2024-0417 (mockup), area, serial, responsible, maint due | Inventory list/detail; resolve stage 1 |
| `DeviceInstance` draft/review | 37 + 29 rows | Clarifications / incomplete inventarize |
| `DeviceInstance` retired | 47 | Lifecycle filters |
| Overdue maintenance fields | 76 units | Wartung pressure on device (not full duty calendar) |
| `MaintenanceEvent` | *(missing)* | No maintenance history rows |
| `DeviceUnitEvent` | *(missing)* | Thin unit timeline until actions |

**Connection:** `DeviceInstance.modelId` → shared `DeviceModel`; `tenantId` + `inventoryNumber` unique; optional `(tenantId, modelId, serialNumber)`.

---

### 5.5 Registration freeze (duties) — **not seeded**

| Model | Example (recommended to add) | Effect when present |
|-------|------------------------------|---------------------|
| `DeviceReleaseSnapshot` | Released pump + classificationId + `derivedDuties` JSON | Audit “what applied at go-live” |
| `DeviceDuty` | `dutyKey=stk`, `dueAt` overdue / soon / ok | Due-dates board; complete rolls next due |
| `DeviceDuty` | `dutyKey=wartung` | Aligns with instance `nextMaintenanceDueAt` |
| `DutyPerformance` | Completed STK by named person | History on device book / audit |
| `DeviceEvidence` | Level-3 Abnahme ref | Release/reclassify gates |
| `DeviceClarification` | Deferred MTK field | Klärliste items |

**Connection:**

- `DeviceInstance` → `DeviceReleaseSnapshot` → `DeviceDuty[]`
- `DeviceDuty` → optional `ServiceRequest` / `InspectionRun` / reminders

**Without these:** largest functional hole for “test all features.”

---

### 5.6 Service & dispatch — **not seeded**

| Model | Example | Effect |
|-------|---------|--------|
| `ServiceRequest` | STK due → assigned, `state` captured→… | Requests UI |
| `StatusEvent` | Timeline | Audit of transitions |
| `DispatchRecord` / `DispatchOutbox` | Mail/API pending | Dispatch worker demos |
| `OrderRequest` | Spare part for known instance | Parts path |
| `CapturedArticle` | Unknown nameplate | Capture-only SR |

**Connection:** SR may point at `deviceInstanceId` and/or `dutyId`; partner disposition sets `assigneeUserId` / `executorOrgId`.

---

### 5.7 Partner & Prüfpartner — **not in this pack** (partially in app seed)

| Model | Example | Effect |
|-------|---------|--------|
| `Organisation` | MSR / RTS | Partner console org |
| `ServiceContract` | T-MVZ ↔ MSR, scope grants | Acting allowed in clinic |
| `ServiceContractScopeGrant` | allow/deny feature slugs | Scope ∩ RBAC |
| `TestEquipment` | Sicherheitstester | Inspect equipment gate |
| `RefInspectionCatalogue` + steps | Abnahme / STK / Konstanz | Protocol resolution |
| `InspectionRun` sealed | Sets `BaselineMeasurement` | Konstanz can start later |

**Connection:** Partner user → membership → org → contract → tenant; run → device + catalogue + optional duty/SR.

**Seed pack alone:** provider-operated tenants are **structurally incomplete** for partner SaaS demos.

---

### 5.8 Training, safety, reprocessing, authority — **not seeded**

| Cluster | Key models | UI / effect when filled |
|---------|------------|-------------------------|
| Training | `TrainingEvent`, `TrainingRecord`, `RefTrainingType` | Training attendance |
| Incidents | `DeviceIncident` | Incident list/manage |
| FSCA | `FieldSafetyAction`, affected models/devices | Field-safety workflow |
| Reprocessing | profile, links, checks, batches, items | Scan release / AEMP |
| Constancy | `ConstancyCadence` | Cadence / missing takt |
| Authority | `AuthorityInspection`, findings, checklist refs | Authority visits |
| Overlap | `DutyOverlapDecision` | STK/DGUV overlap decisions |
| Device book | `DeviceBookEntry` (+ composed duties from live duties) | Device book sections |

---

### 5.9 Platform / ops

| Model | Seeded? | Effect |
|-------|---------|--------|
| `Ref*` (rules, Annex2, catalogues, …) | Via **app** seed | Required for import + derive + inspect |
| `AuditEvent` | No | Fills as users act |
| `RoleGrant` | App / UI | Permission administration |
| `RefDashboardTile` / grants | App | Dashboard composition |

---

## 6. Feature × seed readiness matrix

| Feature / route | Ready with this pack? | Needs |
|-----------------|----------------------|-------|
| Login / multi-tenant switch | Yes | — |
| `/catalog` browse/filter | Yes (volume) | Refs for kind/family |
| `/devices` inventory | Yes | Duties for full detail |
| `/locations` | Yes | — |
| `/users` | Yes | — |
| `/registration` Erstanlage | Partial | Live release to create duties |
| `/registration/reclassify` | Partial | Live apply; **cross-tenant side effects** |
| `/due-dates` | **Yes** (freeze subset) | More duties optional |
| `/requests` | **Partial** (12 SRs) | Status timeline / dispatch |
| `/partner/*` | **Partial** (MSR/RTS contracts) | App seed Refs + partner login |
| `/inspect` | **No** | Runs + equipment + baselines |
| Training / incidents | **Partial** | FSCA / authority still empty |
| Reprocessing / constancy | **No** | Profiles/batches/cadence |
| Device book (composed) | Partial | Evidence/entries/duties for rich book |
| Dashboard tiles (duty-based) | Weak | Duties + grants |
| Tenant isolation tests | Yes (instances/users) | Classification still global |
| Catalog scale / search | Yes | 5k models |

Screens/API overview: [PROJECT.md](./PROJECT.md).

---

## 7. Recommended additive seed (minimal SaaS slice)

Do **not** need another 5 000 models. Add roughly:

1. **Per tenant:** 20–40 released instances with **snapshot + duties** (mix overdue / due-7d / ok; STK+MTK+Wartung).  
2. **Partner slice:** 1–2 orgs, contracts for T-MVZ & T-RSG, 3 partner users, scope grants, demo `TestEquipment`.  
3. **Process:** 10 `ServiceRequest`s (open/allocated/transmitted); 2–3 sealed `InspectionRun`s with baselines on Abnahme devices.  
4. **Sparse richness:** 5 training events; 2 incidents; 1 FSCA; 1 reprocessing batch; 3 clarifications; a few `ModelDocument`s.  
5. **If pursuing tenant classification:** regenerate opens as `(tenantId, deviceModelId)` only for tenants that use each model.

Order: app `prisma/seed` (Refs + partner + Prüfpartner) → this demo import → additive process seed (or scripted release against a subset).

---

## 8. Example “good” vs “hollow” instance

**Hollow (current typical released row)**  
`DeviceInstance` + shared `DeviceModel` + shared open classification + maintenance dates  
→ Visible in inventory; **no** due-dates row; **no** inspect-from-duty; device book duties empty.

**Good (target for SaaS demo)**  
Same instance  
→ `DeviceReleaseSnapshot` (classificationId, derivedDuties JSON)  
→ `DeviceDuty` rows (stk, mtk, wartung, …) with realistic `dueAt`  
→ optional open `ServiceRequest` on overdue duty  
→ optional sealed Abnahme run + `BaselineMeasurement`  
→ tenant-local evidence/docs  

**Effect:** One inventory number drives catalog → inventory → due-dates → request → partner disposition → inspect → seal → next Konstanz.

---

## 9. Conclusions

1. **Classifications:** Sufficient (5 000 opens; all instances hang off classified models).  
2. **Multi-tenant master data:** Sufficient to demo shared catalog + isolated inventory/users.  
3. **SaaS process coverage:** **Improved** — freeze subset + duties + SRs + partner contracts are in `seed/`. Still missing inspect seal, FSCA, reprocessing batches, authority.  
4. **Governance tension:** Catalogue remains **global**; clinic-owned catalogue would require `DeviceModel.tenantId`.  
5. **Optimal use:** `prisma/seed` → `npx tsx seed/import_seed.ts`; grow `FREEZE_TARGETS` in `process_layer.py` or add inspect/FSCA slices as needed.

---

## 10. References

- External seed README: `Seed Data 14102026/seed/README.md`  
- External importer: `Seed Data 14102026/seed/import_seed.ts`  
- App architecture: [SCHEMA_AND_ARCHITECTURE.md](./SCHEMA_AND_ARCHITECTURE.md)  
- App screens/API: [PROJECT.md](./PROJECT.md)  
- Live schema: `prisma/schema.prisma`  
- App seed entry: `prisma/seed.ts`  
