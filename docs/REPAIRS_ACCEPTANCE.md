# Repairs package (E70–E80) — acceptance QA

Short checklist for manual / e2e verification. One line per item.

Implementation status (2026-11): partner create-order, order detail, repair disposition filters, Today tiles, clinic ops/loaner/book Nr. 4 wired. Walk remaining items in a seeded demo.

- [x] **A1** Fault `out_of_service` → book entry + device `locked` + repair order in one transaction.
- [x] **A2** Fault `restricted` → book entry + `malfunction_triage` clarification; no order created.
- [x] **A3** Role `user` can report a fault; triage / quote decide / unlock return 403. *(user has `requests:create` only; triage/quote/unlock need approve/inventory)*
- [x] **A4** Triage „order“ copies `faultDescription` + `bookEntryId`; „no action“ without note is rejected.
- [x] **A5** Partner creates/edits quote; clinic approves or rejects (reject needs note); technician cannot edit quotes. *(partner quote UI on order detail)*
- [x] **A6** K-REP seal rejects `part_replaced` without parts or without photo/`noPhotoReason`. *(assertRepairReportGates on seal)*
- [x] **A7** Valid K-REP complete creates exactly one `MaintenanceEvent(kind=repair)`; second complete is idempotent. *(seal → completeRepairFromRun)*
- [x] **A8** `repaired` + `safetyRelevant` → mandatory `post_repair_check`, device stays `locked` (source `inspection`). *(applyRepairOutcome; safety via `sicherheitsrelevant: ja` in Ergebnis)*
- [x] **A9** `repaired`, not safety-relevant, Anlage-1 → follow-up `proposed`; confirm/discard with note works.
- [x] **A10** `repaired`, non-Anlage-1, no other lock → device `in_service` without follow-up.
- [x] **A11** `parts_ordered` → D3 repair continuation with `followUpNeeds` from parts rows.
- [x] **A12** Ops unlock only with `inventory:update` + note; every transition writes `DeviceUnitEvent`. *(panel gated to locked/under_repair)*
- [x] **A13** Loaner link sets `replaced` / `loaner` and opens instruction clarification. *(clinic LoanerAssignPanel)*
- [x] **A14** Buch Nr. 4 / device history show the maintenance event with performer and order link.
- [x] **A15** Tile `geraete-gesperrt` count matches instances with `operationalState ∈ {locked, under_repair}`.
- [x] **A16** Fremdbericht without company rejected; valid one writes external MaintenanceEvent + book row + class follow-up (no repair SR).
- [x] **A17** Send-in schedules without visit; K-REP with `skipVisit` seals; on-site still requires visit started. *(partner create-order + send-in timeline)*
- [x] **A18** Follow-up `checkType` by class: reprocessing→requalification, mess/MTK→mtk, radiology→acceptance_constancy, pump→stk.
- [x] **A19** Training gate `block` (Medisens) → assign untrained tech returns **423**; override needs reason + role and is audited. *(create-order blocks without override)*
- [x] **A20** Partner refuses K-REP start on blocked un-overridden request; override unlocks that request only; `hint` never blocks.
- [x] **A21** Parts proposal idempotent per request+parts; order sets status/`orderRef`/`triggeredVia=devicecare`; discard needs reason.
- [x] **A22** Role `order` may order proposals; `inspector` may create but not order/discard.
- [x] **A23** Backoffice never lists parts proposals; external reports appear like partner-performed ones in book/detail.
- [x] **A24** Feature flag off → fault / K-REP / quote / ops routes no-op or 403; Version A behaviour unchanged. *(complete, parts, partner quote, K-REP start/seal gated)*

## Partner create-order (gap closed)

- [x] SL/GF: **Auftrag anlegen** from disposition → `/partner/orders/new`
- [x] `POST /api/partner/orders` allocates + transmits to partner executor
- [x] Stoerung out_of_service → book + lock + transmitted repair SR
- [x] Stoerung restricted/usable (repair) → book / triage without SR (clinic parity)
- [x] Send-in requires workshop; no appointment; timeline on order detail
- [x] Training gate block on create (no override); disposition remains override path
- [x] Repair filter chips + Today tiles (quotes / proposed / open repairs)
- [x] Order detail cards (fault, quote, device ops, send-in, proposal, report, links, parts, history)

## E2E gap close (security + compatibility) — wiring

- [x] Training gate: exact OEM qual / label (no `startsWith repair_`)
- [x] K-REP catalogue OEM quals detached; demo tech seeded with device-relevant OEM only
- [x] Parts proposal: assignee or disposition lead + executor organisation (Organisation.id)
- [x] Disposition TRAINING_GATE override dialog + overridden chip
- [x] E78 `checkType` → inspection type + generic K-MTK-gen / K-PNI seeds
- [x] Inspect BV handoff card + send-in FollowUpCard visit waiver
- [x] Clinic send-in timeline (read-only) + device send-in chip + Heute send-in surface
- [x] Manual E2E walked on seeded demo (2026-11-11) — `scripts/e2e-repairs-walk.mjs` **18/18**
  - A19: untrained create/assign **423 TRAINING_GATE**; lead override with reason succeeds
  - A17/E77: clinic send-in DTO + device `openSendInRepair` chip on INV-10001
  - Repair→K-REP preview/start/seal on Medisens ThermoScan; child follow-up `checkType=mtk` (A18)
  - E80: BV create + idempotent fingerprint; clinic door rejected
  - K-PNI + K-MTK-gen present in partner catalogues
