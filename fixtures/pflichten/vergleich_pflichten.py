# -*- coding: utf-8 -*-
"""Prüfvorlage gegen die Ableitung des Livesystems halten.

Die Erwartungsdatei spricht das Vokabular des Mockups (deutsch), das
Livesystem das des Schemas (englisch). Dieses Skript übersetzt die eine
Seite in die andere und vergleicht.

Die Abbildung unten IST der eigentliche Inhalt: Sie legt fest, welches
Feld im Mockup welchem Feld im Schema entspricht. Weicht etwas ab, liegt
es entweder an der Ableitung oder an dieser Tabelle — beides ist zu
klären und nicht zu überschreiben.

Zwei Betriebsarten:

  python3 vergleich_pflichten.py --normalisieren
      schreibt pflichten-erwartung-schema.json — dieselben 222 Fälle im
      Vokabular von schema.prisma. Wer lieber selbst vergleicht, braucht
      nur diese Datei.

  python3 vergleich_pflichten.py --live ableitung.json
      vergleicht und berichtet. Erwartetes Format von ableitung.json:
        [ { "fall": "<Bezeichnung aus der Erwartungsdatei>",
            "duties": [ { "dutyKey": "...", "applicable": true,
                          "deadlineAnchor": "month_end",
                          "intervalValue": 24, "intervalUnit": "months",
                          "confidence": "derived", "category": "inspection",
                          "setsBaseline": false, "requiresBaseline": false,
                          "referenceDeviceId": null }, ... ] }, ... ]
      Unbekannte Zusatzfelder werden ignoriert.
"""
import argparse, io, json, sys

# ---------------------------------------------------------------------------
# Abbildung Mockup → Schema
# ---------------------------------------------------------------------------

ANKER = {
    "tag": "exact_day",
    "monatsende": "month_end",
    "jahresende": "year_end",
    "ereignis": "event",
    "intervall": "interval",
    "prozess": "process",
    "dauerhaft": "permanent",
    "verweis": "reference",
    "entfaellt": "none",
}

VERTRAUEN = {
    "verified": "verified",
    "verantwortet": "responsible",
    "festlegung": "determination",
    "derived": "derived",
    "n/a": "not_applicable",
}

KATEGORIE = {"pruefung": "inspection", "betrieb": "operating"}

EINHEIT = {"Monate": "months", "Jahre": "years", "Tage": "days"}

# Pflicht-Kennung im Mockup → dutyKey im Schema. Kennungen mit Suffix
# (konstanz-aufnahme, valref-rdg, zub-0) werden am Bindestrich getrennt.
DUTY_KEY = {
    "wartung": "wartung",
    "stk": "stk",
    "mtk": "mtk",
    "abnahme": "abnahme",
    "konstanz": "konstanz",
    "sv": "sv",
    "aerztl": "aerztl",
    "nuklear": "nuklear",
    "itsec": "itsec",
    "install": "install",
    "aufb": "aufbereitung",
    "aufb-extern": "kontrolle",
    "valref": "validierung-verweis",
    "eigen-val": "validierung",
    "einmal": "einmalprodukt",
    "zub": "zubehoer",
    "netz": "vernetzung",
    "impl": "implantat",
}


def duty_key(pflicht_id):
    """Mockup-Kennung auf dutyKey abbilden, Suffixe abtrennen."""
    if pflicht_id in DUTY_KEY:
        return DUTY_KEY[pflicht_id]
    stamm = pflicht_id.split("-")[0]
    return DUTY_KEY.get(stamm, pflicht_id)


def umschluesseln(p):
    """Eine Pflicht aus der Erwartungsdatei ins Schemavokabular."""
    key = duty_key(p["id"])
    category = KATEGORIE.get(p.get("kategorie"), p.get("kategorie"))
    # P4 — Wartung / commissioned-reprocessing control are operating duties;
    # the mockup still labels them pruefung.
    if key in ("wartung", "kontrolle"):
        category = "operating"
    return {
        "dutyKey": key,
        "quelleId": p["id"],                       # zur Rückverfolgung
        "category": category,
        "applicable": bool(p.get("einschlaegig")),
        "deadlineAnchor": ANKER.get(p.get("bezug"), p.get("bezug")),
        "intervalValue": p.get("frist"),
        "intervalUnit": EINHEIT.get(p.get("einheit")),
        "cadenceLabel": p.get("takt"),
        "confidence": VERTRAUEN.get(p.get("vertrauen"), p.get("vertrauen")),
        "setsBaseline": bool(p.get("setztBezugswerte")),
        "requiresBaseline": bool(p.get("brauchtBezugswerte")),
        "hasReferenceDevice": bool(p.get("verweisAufGeraet")),
        "basisText": p.get("grundlage"),
    }


VERGLEICHSFELDER = ["category", "applicable", "deadlineAnchor", "intervalValue",
                    "intervalUnit", "confidence", "setsBaseline",
                    "requiresBaseline", "hasReferenceDevice"]


def normalisieren(erwartung):
    out = []
    for f in erwartung["faelle"]:
        out.append({
            "fall": f["fall"],
            "merkmale": f["merkmale"],
            "releaseLevel": f["freigabestufe"],
            "duties": [umschluesseln(p) for p in f["pflichten"]],
            "prerequisites": [{
                "code": v["schluessel"], "label": v["titel"],
                "legalBasis": v["grundlage"], "mandatory": v["pflicht"],
                "evidenceKind": {"haken": "confirmation", "dokument": "document",
                                 "drittprotokoll": "third_party"}.get(
                                     v["nachweisart"], v["nachweisart"]),
            } for v in f["voraussetzungen"]],
        })
    return out


def vergleiche(soll, ist):
    """Fall für Fall, Pflicht für Pflicht, Feld für Feld."""
    ist_nach_fall = {}
    for f in ist:
        ist_nach_fall.setdefault(f.get("fall"), f)

    befunde = []
    geprueft = 0
    for s in soll:
        i = ist_nach_fall.get(s["fall"])
        if i is None:
            befunde.append((s["fall"], "—", "Fall fehlt in der Ableitung", "", ""))
            continue
        ist_duties = {}
        for d in i.get("duties", []):
            ist_duties.setdefault(d.get("dutyKey"), []).append(d)

        for d_soll in s["duties"]:
            k = d_soll["dutyKey"]
            kandidaten = ist_duties.get(k) or []
            if not kandidaten:
                # Eine nicht einschlaegige Pflicht darf fehlen, wenn das
                # Livesystem sie gar nicht erst erzeugt - das ist eine
                # zulaessige Auslegung und kein Fehler.
                if not d_soll["applicable"]:
                    continue
                befunde.append((s["fall"], k, "Pflicht fehlt", "erwartet", "—"))
                continue
            d_ist = kandidaten.pop(0)
            for feld in VERGLEICHSFELDER:
                a, b = d_soll.get(feld), d_ist.get(feld)
                if feld == "intervalValue" and not d_soll["applicable"]:
                    continue  # P1: beide Seiten sollen hier leer sein
                if a != b:
                    befunde.append((s["fall"], k, feld, repr(a), repr(b)))
                geprueft += 1
        # P1 ausdruecklich pruefen: Eine nicht einschlaegige Pflicht traegt
        # keine Frist, keinen Anker ausser "none" und kein Vertrauen ausser
        # "not_applicable". Das war der haeufigste Befund im Mockup - 97 von
        # 184 Kombinationen (fruehere Fixture; jetzt 222) - und wird deshalb geprueft.
        for d_ist in i.get("duties", []):
            if d_ist.get("applicable"):
                continue
            k = d_ist.get("dutyKey")
            if d_ist.get("intervalValue") is not None:
                befunde.append((s["fall"], k, "P1: Frist trotz applicable=false",
                                "None", repr(d_ist.get("intervalValue"))))
            if d_ist.get("deadlineAnchor") not in (None, "none"):
                befunde.append((s["fall"], k, "P1: Anker trotz applicable=false",
                                "'none'", repr(d_ist.get("deadlineAnchor"))))
            if d_ist.get("confidence") not in (None, "not_applicable"):
                befunde.append((s["fall"], k, "P1: Vertrauen trotz applicable=false",
                                "'not_applicable'", repr(d_ist.get("confidence"))))

        for k, rest in ist_duties.items():
            for d in rest:
                if d.get("applicable"):
                    befunde.append((s["fall"], k, "Pflicht zusätzlich", "—", "vorhanden"))
    return befunde, geprueft


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--erwartung", default="pflichten-erwartung.json")
    ap.add_argument("--live", help="JSON mit der Ableitung des Livesystems")
    ap.add_argument("--normalisieren", action="store_true",
                    help="nur die übersetzte Erwartung schreiben")
    ap.add_argument("--aus", default="pflichten-erwartung-schema.json")
    a = ap.parse_args()

    erwartung = json.load(io.open(a.erwartung, encoding="utf-8"))
    soll = normalisieren(erwartung)
    n = sum(len(f["duties"]) for f in soll)
    print("Erwartung: %d Fälle, %d Pflichten" % (len(soll), n))

    if a.normalisieren or not a.live:
        io.open(a.aus, "w", encoding="utf-8").write(json.dumps(
            {"_hinweis": "Erzeugt aus pflichten-erwartung.json mit "
                         "vergleich_pflichten.py. Feldnamen folgen schema.prisma.",
             "faelle": soll}, ensure_ascii=False, indent=1))
        print("Geschrieben: %s" % a.aus)
        if not a.live:
            print("\nKein --live angegeben — es wurde nur übersetzt, nicht verglichen.")
        return

    ist = json.load(io.open(a.live, encoding="utf-8"))
    if isinstance(ist, dict) and "faelle" in ist:
        ist = ist["faelle"]
    befunde, geprueft = vergleiche(soll, ist)

    print("Verglichene Feldwerte: %d" % geprueft)
    print("Abweichungen: %d\n" % len(befunde))
    if befunde:
        print("%-38s %-22s %-22s %-14s %s"
              % ("Fall", "dutyKey", "Feld", "erwartet", "Livesystem"))
        print("-" * 118)
        for z in befunde[:80]:
            print("%-38s %-22s %-22s %-14s %s" % z)
        if len(befunde) > 80:
            print("… %d weitere" % (len(befunde) - 80))
        print("\nJede Abweichung ist zu klären, nicht zu überschreiben: "
              "Sie kann ebenso gut an der Abbildung in diesem Skript liegen.")
    sys.exit(1 if befunde else 0)


if __name__ == "__main__":
    main()
