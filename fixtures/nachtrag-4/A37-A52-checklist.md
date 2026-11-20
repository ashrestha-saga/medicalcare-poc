# Nachtrag 4 acceptance A37–A52 (manual)

Flag: `Tenant.featureFlags.radiation_dguv = true` (demo tenant seeded).

| ID | Check | How |
|---|---|---|
| A37 | Betriebsmittel create without model, released, DGUV only, absent from §14 | `/devices/equipment/new` → filter `kind=equipment`; export §14 |
| A38 | Determination 422 matrix (own_check needs months+GBU; not_applicable only if electrical=false) | `PUT /api/devices/:id/duties/dguv/determination` |
| A39 | Own DGUV short check + Plakette on pass | `POST /api/duties/:id/complete-dguv-short` |
| A40 | Determination list tile | Dashboard `dguv-ohne-festlegung` → `/duties/dguv-determination` |
| A41–A44 | Constancy A/B/C + deviation clarification + rso lock; partner never locks | `/api/duties/konstanz/routine`, resolve-constancy |
| A45 | ServiceTypeGate on assign (SV never overridable) | Disposition assign → 423 `SERVICE_TYPE_GATE` |
| A46 | Gate on partner run start | `POST /api/partner/inspection-runs` |
| A47 | Label required on STK/DGUV pass; forbidden on constancy | Seal UI + `assertLabelRequired` tests |
| A48 | Sammelauftrag progress + visit institution signature | `POST /api/requests/group`, visit institution-signature |
| A49–A50 | SV fulfilment=external + certificate intake | Create order Fremdleistung; `/api/requests/:ref/external-certificate` |
| A51 | Seed reference limits carry source/asOf | K-DGUV step optionsJson |
| A52 | DGUV mitnehmen on STK visit when gate passes | Visits panel hint + attach |

Unit coverage: `sealGates.test.ts` (R38 + visit signature), `serviceTypeGateService.test.ts` (R37 keys), `radiationDguv.test.ts` (flag).
