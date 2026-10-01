# How to run the duty fixture

**For:** Anish · **From:** André, MERZLJAK W/V GmbH · 30.09.2026 (2nd revision)

The fixture checks `deriveDuties` against 222 characteristic combinations
and 1,197 expected duties. It takes about an hour to wire up once.

**If you already wired the earlier version:** the expectation has grown from
184 to 214 cases. Two characteristics that were missing are now varied —
`aufbExtern` (reprocessing contracted out) and `zulassung` (notification
under § 19 StrlSchG vs licence under § 12). The 184 earlier cases are
unchanged. The added 30 exercise the second AUF-01 rule, which nothing
tested before: contracted-out reprocessing produces a *Kontrolle* duty on
the service provider, not a validation duty of your own.

---

## The three files

| File | What it is |
|---|---|
| `pflichten-erwartung.json` | The expectation, in the mockup's vocabulary (German keys). The original. |
| `pflichten-erwartung-schema.json` | The same 184 cases translated into `schema.prisma` field names. **Use this one.** |
| `vergleich_pflichten.py` | Does the comparison and reports differences. |

All three are in the package under `fixtures/` and `tools/`. They are
generated from mockup **v20**, not v18 — see the note on the STK rule in
the README.

---

## What you need to produce

A JSON file with your derivation output, one entry per case:

```json
[
  {
    "fall": "bildgebung · Strahlenart roentgen",
    "duties": [
      {
        "dutyKey": "stk",
        "applicable": false,
        "deadlineAnchor": "none",
        "intervalValue": null,
        "intervalUnit": null,
        "confidence": "not_applicable",
        "category": "inspection",
        "setsBaseline": false,
        "requiresBaseline": false,
        "referenceDeviceId": null
      }
    ]
  }
]
```

- `fall` must match the string in `pflichten-erwartung-schema.json` exactly —
  that is how the two sides are paired.
- The input characteristics for each case are in `merkmale` on the same
  object in that file. Feed them to `deriveDuties` unchanged.
- Extra fields are ignored. Missing optional fields are treated as null.

---

## Running it

```bash
python3 vergleich_pflichten.py --live ableitung.json
```

Exit code 0 means no differences; non-zero means there are. Suitable for CI.

To regenerate the translated expectation yourself:

```bash
python3 vergleich_pflichten.py --normalisieren
```

---

## What the output means

Each line is one difference: case, dutyKey, field, expected, yours.

**Please do not resolve a difference by editing the expectation.** It can
just as easily come from the mapping table at the top of
`vergleich_pflichten.py` — that table translates between the two
vocabularies (`einschlaegig` → `applicable`, `jahresende` → `year_end`,
`festlegung` → `determination`, and so on) and I may have got an entry
wrong. Send me the lines and we settle them case by case.

It is also entirely possible that your derivation is right and the mockup
is wrong. That has happened before in this project.

---

## One thing to check separately

The fixture cannot see your seed data. **Please check which
`deadlineAnchor` the seeded `RefInspectionType` row for validation
carries.**

My view: the end-of-year rule in § 15 (5) MPBetreibV applies to the MTK.
For a repeat performance qualification the correct anchor is the date of
the last qualification, so `exact_day` rather than `year_end`. The mockup
currently says `jahresende`, which is why the fixture carries it — the
question is open, and it decides the due date of every validation.

It is one line in the seed. Worth settling before it goes live.

---

## Two special cases in the comparison

**A non-applicable duty may be absent.** If your derivation simply does
not create a row for a duty that does not apply, that is a legitimate
reading and is not reported. Only a *missing applicable* duty is.

**P1 is checked explicitly.** Any duty you return with
`applicable: false` must have no `intervalValue`, `deadlineAnchor: "none"`
and `confidence: "not_applicable"`. Each of the three is reported
separately. This was the most frequent finding in the mockup, so it is
verified rather than assumed — 347 of the 1,197 duties are non-applicable
and every one of them is checked.

---

## What the fixture still cannot tell you

It exercises `deriveDuties`. It does **not** see the code path that writes
`DeviceModelClassification.stk` at release. If that path re-expresses the
STK condition instead of reading it from the derived duty, the two will
drift and the fixture will stay green throughout. My own mockup had exactly
that defect until today — the derived duty said "no STK", the classification
written at release said "STK: yes", for AED exemption together with a
pre-MPG legacy device. One line: read the classification from the derived
duty.
