import type {
  DashboardBandGroupDTO,
  DashboardBoardDTO,
  DashboardTileDTO,
  DashboardTileSegmentDTO,
  DashboardTileUrgency,
  TenantContext,
} from "@/interfaces";
import { hrefForDashboardTile } from "@/constants/dashboardTileLinks";
import { DASHBOARD_ROLE_LABELS, isOverviewTile, tileKind } from "@/constants/dashboardTiles";
import type { UserRole } from "@/interfaces/session";
import { prisma } from "@/lib/prisma";
import { clarificationService } from "@/services/clarifications/clarificationService";
import { trimDecidesZone } from "@/services/k10/k10HardRules";
import { reprocessingEvidenceService } from "@/services/reprocessingEvidence/reprocessingEvidenceService";
import {
  getAssignedAreaIds,
  getEffectiveAreaScope,
} from "@/services/users/userAreaScope";
import { dashboardTileService } from "./dashboardTileService";

/** Band groups appear only when a tile targets that view (mockup zieleVon). */
const BAND_FROM_HREF: Record<string, "pruefung" | "behoerde" | "rueckruf"> = {
  "/due-dates": "pruefung",
  "/constancy-cadence": "pruefung",
  "/duty-overlap": "pruefung",
  "/authority": "behoerde",
  "/field-safety": "rueckruf",
};

type TileValue = {
  count: number | null;
  label: string;
  urgency: DashboardTileUrgency;
  denominator: number | null;
  denominatorLabel: string | null;
  hint: string | null;
  segments: DashboardTileSegmentDTO[];
};

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

function daysUntil(isoOrDate: Date | string, today: Date): number {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((utc - today.getTime()) / 86400000);
}

function W(
  count: number | null,
  label: string,
  urgency: DashboardTileUrgency,
  denominator?: number | null,
  denominatorLabel?: string | null,
  hint?: string | null,
  segments?: DashboardTileSegmentDTO[],
): TileValue {
  return {
    count,
    label,
    urgency,
    denominator: denominator ?? null,
    denominatorLabel: denominatorLabel ?? null,
    hint: hint ?? null,
    segments: (segments ?? []).filter((s) => s.count > 0),
  };
}

async function deviceStateSegments(): Promise<{
  total: number;
  segments: DashboardTileSegmentDTO[];
}> {
  const rows = await prisma.deviceInstance.groupBy({
    by: ["state"],
    _count: { _all: true },
  });
  const byState = Object.fromEntries(rows.map((r) => [r.state, r._count._all])) as Record<
    string,
    number
  >;
  const released = byState.released ?? 0;
  const draft = (byState.draft ?? 0) + (byState.review ?? 0);
  const retired = byState.retired ?? 0;
  const total = released + draft + retired;
  return {
    total,
    segments: [
      { key: "released", count: released, tone: "ok", label: "freigegeben" },
      { key: "draft", count: draft, tone: "warn", label: "Entwurf" },
      { key: "retired", count: retired, tone: "muted", label: "außer Betrieb" },
    ],
  };
}

async function valueForTile(ctx: TenantContext, key: string): Promise<TileValue> {
  const today = startOfTodayUtc();
  const in30 = addDays(today, 30);
  const in90 = addDays(today, 90);

  switch (key) {
    case "ueberfaellig": {
      const [count, total] = await Promise.all([
        prisma.deviceDuty.count({
          where: { applicable: true, suspendedAt: null, dueAt: { lt: today } },
        }),
        prisma.deviceDuty.count({
          where: { applicable: true, suspendedAt: null, dueAt: { not: null } },
        }),
      ]);
      return W(
        count,
        count ? "überfällig" : "nichts überfällig",
        count > 0 ? "overdue" : "ok",
        total,
        "Pflicht mit Termin|Pflichten mit Termin",
      );
    }
    case "faellig-30": {
      const [count, total] = await Promise.all([
        prisma.deviceDuty.count({
          where: { applicable: true, suspendedAt: null, dueAt: { gte: today, lte: in30 } },
        }),
        prisma.deviceDuty.count({
          where: { applicable: true, suspendedAt: null, dueAt: { not: null } },
        }),
      ]);
      return W(
        count,
        count ? "in den nächsten 30 Tagen" : "nichts in 30 Tagen",
        count > 0 ? "due" : "ok",
        total,
        "Pflicht mit Termin|Pflichten mit Termin",
      );
    }
    case "freigabe-blockiert": {
      const [count, total] = await Promise.all([
        prisma.deviceInstance.count({ where: { state: "draft" } }),
        prisma.deviceInstance.count(),
      ]);
      return W(
        count,
        count ? "als Entwurf, nicht freigegeben" : "keine Entwürfe",
        count > 0 ? "due" : "ok",
        total,
        "Gerät im Bestand|Geräten im Bestand",
      );
    }
    case "klaerliste": {
      const count = await clarificationService.countOpenCases(ctx);
      return W(count, "offene Klärfälle", count > 0 ? "info" : "ok");
    }
    case "fristen-ohne-beleg": {
      const [derived, total] = await Promise.all([
        prisma.deviceDuty.count({
          where: {
            applicable: true,
            suspendedAt: null,
            dueAt: { not: null },
            confidence: { not: "verified" },
          },
        }),
        prisma.deviceDuty.count({
          where: { applicable: true, suspendedAt: null, dueAt: { not: null } },
        }),
      ]);
      const verified = Math.max(0, total - derived);
      return W(total, "mit Termin", "info", total || null, "Frist|Fristen", null, [
        { key: "verified", count: verified, tone: "ok", label: "am Verordnungstext belegt" },
        { key: "derived", count: derived, tone: "muted", label: "abgeleitet" },
      ]);
    }
    case "auftraege-termin": {
      const [count, total] = await Promise.all([
        prisma.serviceRequest.count({ where: { state: "scheduled" } }).catch(() => 0),
        prisma.serviceRequest.count().catch(() => 0),
      ]);
      return W(
        count,
        count ? "mit Termin" : "kein Termin",
        "info",
        total || null,
        "Auftrag|Aufträgen",
      );
    }
    case "bestand-zustand": {
      const { total, segments } = await deviceStateSegments();
      return W(total, "im Bestand", "info", total || null, "Gerät|Geräten", null, segments);
    }
    case "modelle-ohne-einstufung": {
      const [missing, total] = await Promise.all([
        prisma.deviceModel.count({ where: { classifications: { none: { validTo: null } } } }),
        prisma.deviceModel.count(),
      ]);
      const classified = Math.max(0, total - missing);
      return W(total, "im Katalog", "info", total || null, "Modell|Modellen", null, [
        { key: "classified", count: classified, tone: "ok", label: "mit Einstufung" },
        { key: "missingClassification", count: missing, tone: "warn", label: "ohne" },
      ]);
    }
    case "vorkommnis-unbewertet": {
      const [count, total] = await Promise.all([
        prisma.deviceIncident.count({ where: { suspectedSerious: null, closedAt: null } }),
        prisma.deviceIncident.count(),
      ]);
      return W(
        count,
        count ? "ohne Bewertung der Schwere" : "alle bewertet",
        count > 0 ? "overdue" : "ok",
        total,
        "Vorkommnis|Vorkommnissen",
      );
    }
    case "vorkommnis-ungemeldet": {
      const [count, schwer] = await Promise.all([
        prisma.deviceIncident.count({
          where: { suspectedSerious: true, reportedAt: null, closedAt: null },
        }),
        prisma.deviceIncident.count({ where: { suspectedSerious: true } }),
      ]);
      return W(
        count,
        count ? "meldepflichtig, nicht gemeldet" : "keine offene Meldung",
        count > 0 ? "overdue" : "ok",
        schwer,
        "als schwerwiegend bewerteten Vorkommnis|als schwerwiegend bewerteten Vorkommnissen",
      );
    }
    case "rueckruf-offen": {
      const [count, total] = await Promise.all([
        prisma.fieldSafetyAction.count({ where: { closedAt: null } }),
        prisma.fieldSafetyAction.count(),
      ]);
      return W(
        count,
        count ? "offen" : "keine offenen",
        count > 0 ? "due" : "ok",
        total,
        "Rückruf|Rückrufen",
      );
    }
    case "rueckruf-abgleich": {
      const [count, total] = await Promise.all([
        prisma.fieldSafetyDeviceAction.count({
          where: {
            fieldSafetyAction: { closedAt: null },
            OR: [{ affected: null }, { affected: true, actionTakenAt: null }],
          },
        }),
        prisma.fieldSafetyDeviceAction.count({
          where: { fieldSafetyAction: { closedAt: null } },
        }),
      ]);
      return W(
        count,
        count ? "Geräte noch zu prüfen / Maßnahme offen" : "Abgleich vollständig",
        count > 0 ? "due" : "ok",
        total,
        "Gerät in offenen Rückrufen|Geräten in offenen Rückrufen",
      );
    }
    case "buch-stoerungen": {
      const rows = await prisma.deviceBookEntry.groupBy({
        by: ["kind"],
        _count: { _all: true },
      });
      const byKind = Object.fromEntries(rows.map((r) => [r.kind, r._count._all])) as Record<
        string,
        number
      >;
      const malfunction = byKind.malfunction ?? 0;
      const operatingError = byKind.operating_error ?? 0;
      const note = byKind.note ?? 0;
      const total = malfunction + operatingError + note;
      return W(total, "im Gerätebuch", "info", total || null, "Bucheintrag|Bucheinträgen", null, [
        { key: "malfunction", count: malfunction, tone: "muted", label: "Funktionsstörung" },
        { key: "operating_error", count: operatingError, tone: "muted", label: "Bedienfehler" },
        { key: "note", count: note, tone: "muted", label: "Hinweis" },
      ]);
    }
    case "mpsb-fehlt": {
      const sites = await prisma.site.findMany({ select: { id: true } });
      const active = await prisma.safetyOfficerAppointment.findMany({
        where: {
          appointedFrom: { lte: today },
          OR: [{ appointedTo: null }, { appointedTo: { gte: today } }],
        },
        select: { siteId: true },
      });
      const covered = new Set(active.map((a) => a.siteId));
      const missing = sites.filter((s) => !covered.has(s.id)).length;
      return W(
        missing,
        missing ? "ohne Beauftragten" : "alle bestellt",
        missing > 0 ? "due" : "ok",
        sites.length || null,
        "pflichtigen Standort|pflichtigen Standorten",
      );
    }
    case "mpsb-bestellung": {
      const sites = await prisma.site.count();
      const appointedRows = await prisma.safetyOfficerAppointment.groupBy({
        by: ["siteId"],
        where: {
          appointedFrom: { lte: today },
          OR: [{ appointedTo: null }, { appointedTo: { gte: today } }],
        },
      });
      const appointed = appointedRows.length;
      const missing = Math.max(0, sites - appointed);
      return W(sites, "Standorte", "info", sites || null, "Standort|Standorten", null, [
        { key: "appointed", count: appointed, tone: "ok", label: "mit benanntem Beauftragten" },
        { key: "missing", count: missing, tone: "warn", label: "ohne" },
      ]);
    }
    case "implantat-doku": {
      const count = await prisma.deviceDuty.count({
        where: { dutyKey: "implantat", applicable: true, suspendedAt: null },
      });
      return W(
        count,
        count ? "Implantatpflichten" : "keine Implantatpflicht",
        count > 0 ? "info" : "ok",
      );
    }
    case "meine-geraete": {
      const assigned = await getAssignedAreaIds(ctx);
      if (assigned.length === 0) return W(0, "kein Heimatbereich", "empty");
      const [count, total] = await Promise.all([
        prisma.deviceInstance.count({
          where: { areaId: { in: assigned }, state: { not: "retired" } },
        }),
        prisma.deviceInstance.count(),
      ]);
      return W(count, "in meinem Bereich", "info", total, "Gerät im Bestand|Geräten im Bestand");
    }
    case "meine-einweisungen": {
      const count = await prisma.trainingRecord.count({ where: { personId: ctx.user.id } });
      return W(count, "meine Einweisungen", "info");
    }
    case "stoerung-melden":
      return W(null, "", "empty", null, null, "Aktion — Störung über Aufträge melden");
    case "gesperrte-geraete": {
      const scope = await getEffectiveAreaScope(ctx);
      if (scope.mode === "none") {
        return W(0, "keine Sperre", "ok", 0, "Gerät|Geräten");
      }
      const areaFilter =
        scope.mode === "areas" ? { areaId: { in: scope.areaIds } } : {};
      const [count, total] = await Promise.all([
        prisma.deviceInstance.count({
          where: { state: { not: "released" }, ...areaFilter },
        }),
        prisma.deviceInstance.count({ where: areaFilter }),
      ]);
      return W(
        count,
        count ? "nicht freigegeben" : "keine Sperre",
        count > 0 ? "due" : "ok",
        total,
        "Gerät|Geräten",
      );
    }
    case "validierung-geraete": {
      const [count, total] = await Promise.all([
        prisma.deviceDuty.count({
          where: { dutyKey: "validierung", applicable: true, suspendedAt: null },
        }),
        prisma.deviceDuty.count({
          where: { applicable: true, suspendedAt: null },
        }),
      ]);
      return W(
        count,
        count ? "Validierungspflichten" : "keine Validierungspflicht",
        count > 0 ? "info" : "ok",
        total || null,
        "Pflicht|Pflichten",
      );
    }
    case "routine-heute": {
      const [open, dailyTotal] = await Promise.all([
        reprocessingEvidenceService.countOpenDailyChecks(ctx),
        prisma.refReprocessingCheck.count({ where: { cadence: "daily" } }),
      ]);
      return W(
        open,
        open ? "heute noch offen" : "alles erledigt",
        open > 0 ? "due" : "ok",
        dailyTotal || null,
        "arbeitstäglichen Kontrolle|arbeitstäglichen Kontrollen",
      );
    }
    case "charge-offen": {
      const scope = await getEffectiveAreaScope(ctx);
      if (scope.mode === "none") {
        return W(0, "alle freigegeben", "ok", null, "Charge|Chargen");
      }
      const equipmentFilter =
        scope.mode === "areas"
          ? { equipmentDevice: { areaId: { in: scope.areaIds } } }
          : {};
      const [count, total] = await Promise.all([
        prisma.reprocessingBatch.count({
          where: { releaseResult: null, ...equipmentFilter },
        }),
        prisma.reprocessingBatch.count({ where: equipmentFilter }),
      ]);
      return W(
        count,
        count ? "darf nicht verwendet werden" : "alle freigegeben",
        count > 0 ? "overdue" : "ok",
        total || null,
        "Charge|Chargen",
      );
    }
    case "wasser-chemie": {
      const open = await reprocessingEvidenceService.countOpenDailyChecks(ctx, [
        "water",
        "chemistry",
      ]);
      return W(
        open,
        open ? "Wasser/Chemie heute offen" : "Wasser/Chemie erledigt",
        open > 0 ? "due" : "ok",
      );
    }
    case "sterilgut": {
      const open = await reprocessingEvidenceService.countOpenDailyChecks(ctx, ["sterile_storage"]);
      return W(
        open,
        open ? "Sterilgut heute offen" : "Sterilgut erledigt",
        open > 0 ? "due" : "ok",
      );
    }
    case "kopplung-historie":
      return W(null, "", "empty", null, null, "Kopplung am Gerätedatensatz");
    case "aufb-extern":
      return W(null, "", "empty", null, null, "keine beauftragte Aufbereitung");
    case "sachkunde-aufb":
      // No dedicated reprocessing competence code in RefQualification yet.
      return W(null, "", "empty", null, null, "Sachkunde Aufbereitung noch nicht katalogisiert");
    case "konstanz-heute": {
      const count = await prisma.deviceDuty.count({
        where: { dutyKey: "konstanz", applicable: true, suspendedAt: null, dueAt: { not: null } },
      });
      return W(count, "mit geführtem Termin", count > 0 ? "info" : "ok");
    }
    case "konstanz-takt-offen": {
      const [open, total] = await Promise.all([
        prisma.deviceDuty.count({
          where: { dutyKey: "konstanz", applicable: true, suspendedAt: null, dueAt: null },
        }),
        prisma.deviceDuty.count({
          where: { dutyKey: "konstanz", applicable: true, suspendedAt: null },
        }),
      ]);
      const set = Math.max(0, total - open);
      return W(total, "Konstanzprüfungen", open > 0 ? "due" : "ok", total || null, "Pflicht|Pflichten", null, [
        { key: "cadenceSet", count: set, tone: "ok", label: "Takt festgelegt" },
        { key: "cadenceOpen", count: open, tone: "warn", label: "offen" },
      ]);
    }
    case "bezugswerte":
      return W(null, "", "empty", null, null, "Bezugswerte entstehen im Prüfpartner-Zugang");
    case "abnahme-offen": {
      const count = await prisma.deviceDuty.count({
        where: {
          dutyKey: "abnahme",
          applicable: true,
          suspendedAt: null,
          OR: [{ dueAt: null }, { dueAt: { lte: today } }],
        },
      });
      return W(
        count,
        count ? "Abnahme offen / überfällig" : "keine offene Abnahme",
        count > 0 ? "due" : "ok",
      );
    }
    case "aerztliche-stelle": {
      const count = await prisma.deviceDuty.count({
        where: { dutyKey: "aerztl", applicable: true, suspendedAt: null },
      });
      return W(
        count,
        count ? "ärztliche Stelle" : "keine Pflicht",
        count > 0 ? "info" : "ok",
      );
    }
    case "sv-zulassung": {
      const count = await prisma.deviceDuty.count({
        where: { dutyKey: "sv", applicable: true, suspendedAt: null },
      });
      return W(
        count,
        count ? "SV-Prüfungen" : "keine SV-Pflicht",
        count > 0 ? "info" : "ok",
      );
    }
    case "dguv-faellig": {
      // Align with /due-dates?dutyKey=dguv&horizon=30 (upcoming window).
      const count = await prisma.deviceDuty.count({
        where: {
          dutyKey: "dguv",
          applicable: true,
          suspendedAt: null,
          dueAt: { gte: today, lte: in30 },
        },
      });
      return W(count, "DGUV in den nächsten 30 Tagen", count > 0 ? "due" : "ok");
    }
    case "dguv-ohne-festlegung": {
      const withDecision = await prisma.dutyOverlapDecision.findMany({
        where: { validTo: null, coveredDutyKey: "dguv" },
        select: { deviceInstanceId: true },
      });
      const decided = new Set(withDecision.map((d) => d.deviceInstanceId));
      const dguvDuties = await prisma.deviceDuty.findMany({
        where: { dutyKey: "dguv", applicable: true, suspendedAt: null },
        select: { deviceInstanceId: true },
      });
      const count = dguvDuties.filter((d) => !decided.has(d.deviceInstanceId)).length;
      return W(count, count ? "ohne Festlegung zur Abdeckung" : "alle festgelegt", count > 0 ? "info" : "ok");
    }
    case "befund-frist": {
      const [count, total] = await Promise.all([
        prisma.authorityFinding.count({ where: { status: "open", dueAt: { not: null } } }),
        prisma.authorityFinding.count(),
      ]);
      return W(
        count,
        count ? "mit Frist" : "keine offenen",
        count > 0 ? "overdue" : "ok",
        total || null,
        "Befund|Befunden",
      );
    }
    case "befund-nachweis": {
      const [count, total] = await Promise.all([
        prisma.authorityFinding.count({ where: { status: "remediated" } }),
        prisma.authorityFinding.count(),
      ]);
      return W(
        count,
        count ? "behoben, Bestätigung fehlt" : "nichts offen",
        count > 0 ? "info" : "ok",
        total || null,
        "Befund|Befunden",
      );
    }
    case "begehung-vorbereitung": {
      const [gaps, total] = await Promise.all([
        prisma.refAuthorityChecklistItem.count({ where: { covered: false } }),
        prisma.refAuthorityChecklistItem.count(),
      ]);
      return W(
        gaps,
        gaps ? "Checklist-Punkte ohne Daten" : "Checklisten vollständig abgedeckt",
        gaps > 0 ? "info" : "ok",
        total || null,
        "Checklist-Punkt|Checklist-Punkten",
      );
    }
    case "auditfaehigkeit": {
      const released = await prisma.deviceInstance.count({ where: { state: "released" } });
      if (released === 0) {
        return W(null, "", "empty", null, null, "keine freigegebenen Geräte");
      }
      const withOpenClarifications = await prisma.deviceInstance.count({
        where: { state: "released", clarifications: { some: { resolvedAt: null } } },
      });
      const pct = Math.round(((released - withOpenClarifications) / released) * 100);
      return W(
        pct,
        "Prozent freigegeben ohne offene Klärfälle",
        pct < 100 ? "info" : "ok",
        100,
        "Prozent",
      );
    }
    case "offene-punkte-standort": {
      const [clar, findings] = await Promise.all([
        clarificationService.countOpenCases(ctx),
        prisma.authorityFinding.count({ where: { status: "open" } }),
      ]);
      const count = clar + findings;
      return W(count, "über alle Standorte", count > 0 ? "due" : "ok");
    }
    case "bestandsverzeichnis": {
      const [released, total] = await Promise.all([
        prisma.deviceInstance.count({ where: { state: "released" } }),
        prisma.deviceInstance.count(),
      ]);
      return W(released, "im Verzeichnis", "info", total, "Gerät|Geräten");
    }
    case "pruefungen-quartal": {
      const [count, total] = await Promise.all([
        prisma.deviceDuty.count({
          where: { applicable: true, suspendedAt: null, dueAt: { gte: today, lte: in90 } },
        }),
        prisma.deviceDuty.count({
          where: { applicable: true, suspendedAt: null, dueAt: { not: null } },
        }),
      ]);
      return W(count, "im nächsten Quartal", "info", total, "Pflicht mit Termin|Pflichten mit Termin");
    }
    case "betreuung-zugriffe": {
      const since = addDays(today, -90);
      const count = await prisma.auditEvent.count({
        where: {
          tenantId: ctx.tenantId,
          actorKind: "partner",
          occurredAt: { gte: since },
        },
      });
      return W(count, "Partnerzugriffe in 90 Tagen", "info");
    }
    case "befaehigung-auslaufend": {
      const in365 = addDays(today, 365);
      const [qualCount, trainCount] = await Promise.all([
        prisma.personQualification.count({
          where: {
            validUntil: { not: null, lte: in365 },
            user: { tenantId: ctx.tenantId, accountKind: "clinic", active: true },
          },
        }),
        prisma.trainingRecord.count({
          where: {
            validUntil: { not: null, lte: in365 },
            person: { tenantId: ctx.tenantId, active: true },
          },
        }),
      ]);
      const count = qualCount + trainCount;
      return W(
        count,
        count ? "Befähigung läuft aus / abgelaufen" : "nichts auslaufend",
        count > 0 ? "info" : "ok",
      );
    }
    case "traegerschaft-luecke": {
      const [dutyKeys, tiles, grants] = await Promise.all([
        prisma.deviceDuty.findMany({
          where: { applicable: true, suspendedAt: null },
          select: { dutyKey: true },
          distinct: ["dutyKey"],
        }),
        prisma.refDashboardTile.findMany({
          where: { dutyKey: { not: null } },
          select: { key: true, dutyKey: true },
        }),
        prisma.dashboardTileGrant.findMany({ select: { tileKey: true } }),
      ]);
      const grantedTiles = new Set(grants.map((g) => g.tileKey));
      const covered = new Set(
        tiles.filter((t) => t.dutyKey && grantedTiles.has(t.key)).map((t) => String(t.dutyKey)),
      );
      const missing = dutyKeys.filter((d) => !covered.has(String(d.dutyKey))).length;
      return W(
        missing,
        missing ? "Pflichtarten ohne Rollenträger" : "jede Pflicht hat einen Träger",
        missing > 0 ? "due" : "ok",
      );
    }
    default:
      return W(null, "", "empty", null, null, "Kachel ohne Wertberechnung");
  }
}

async function buildBand(
  today: Date,
  allowed: Set<"pruefung" | "behoerde" | "rueckruf">,
): Promise<DashboardBandGroupDTO[]> {
  if (allowed.size === 0) return [];

  const groups: DashboardBandGroupDTO[] = [];

  if (allowed.has("pruefung")) {
    const duties = await prisma.deviceDuty.findMany({
      where: { applicable: true, suspendedAt: null, dueAt: { not: null } },
      select: {
        id: true,
        dueAt: true,
        dutyKey: true,
        deviceInstance: { select: { inventoryNumber: true } },
      },
      take: 200,
      orderBy: { dueAt: "asc" },
    });
    groups.push({
      key: "pruefung",
      title: "Prüfungen und Fristen",
      points: duties
        .filter((d) => d.dueAt)
        .map((d) => {
          const inv = d.deviceInstance.inventoryNumber;
          const key = String(d.dutyKey);
          return {
            group: "pruefung" as const,
            days: daysUntil(d.dueAt!, today),
            date: d.dueAt!.toISOString().slice(0, 10),
            label: inv ? `${key} · ${inv}` : key,
            href: `/due-dates?dutyId=${encodeURIComponent(d.id)}`,
          };
        }),
    });
  }

  if (allowed.has("behoerde")) {
    const findings = await prisma.authorityFinding.findMany({
      where: { status: { in: ["open", "remediated"] }, dueAt: { not: null } },
      select: { id: true, dueAt: true, itemNo: true, description: true },
      take: 100,
      orderBy: { dueAt: "asc" },
    });
    groups.push({
      key: "behoerde",
      title: "Behördliche Befunde",
      points: findings
        .filter((f) => f.dueAt)
        .map((f) => ({
          group: "behoerde" as const,
          days: daysUntil(f.dueAt!, today),
          date: f.dueAt!.toISOString().slice(0, 10),
          label: f.itemNo ? `Befund ${f.itemNo}` : f.description.slice(0, 60),
          href: `/authority?section=findings&findingId=${encodeURIComponent(f.id)}`,
        })),
    });
  }

  if (allowed.has("rueckruf")) {
    const actions = await prisma.fieldSafetyAction.findMany({
      where: { closedAt: null, dueAt: { not: null } },
      select: { id: true, dueAt: true, reference: true },
      take: 100,
      orderBy: { dueAt: "asc" },
    });
    groups.push({
      key: "rueckruf",
      title: "Rückrufe",
      points: actions
        .filter((a) => a.dueAt)
        .map((a) => ({
          group: "rueckruf" as const,
          days: daysUntil(a.dueAt!, today),
          date: a.dueAt!.toISOString().slice(0, 10),
          label: a.reference || "Rückruf",
          href: `/field-safety?actionId=${encodeURIComponent(a.id)}`,
        })),
    });
  }

  return groups.filter((g) => g.points.length > 0);
}

function toDto(
  tile: {
    key: string;
    title: string;
    question: string;
    zone: "decides" | "worklist" | "watch";
    sortOrder: number;
    dutyKey: string | null;
    requiredPermission: string | null;
  },
  value: TileValue,
): DashboardTileDTO {
  return {
    key: tile.key,
    title: tile.title,
    question: tile.question,
    zone: tile.zone,
    kind: tileKind(tile.key),
    sortOrder: tile.sortOrder,
    dutyKey: tile.dutyKey,
    requiredPermission: tile.requiredPermission,
    count: value.count,
    label: value.label,
    urgency: value.urgency,
    href: hrefForDashboardTile(tile.key),
    denominator: value.denominator,
    denominatorLabel: value.denominatorLabel,
    hint: value.hint,
    segments: value.segments,
  };
}

/** Bound parallel fan-out so many tiles don't open unbounded DB connections. */
async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export const dashboardBoardService = {
  async getBoard(ctx: TenantContext): Promise<DashboardBoardDTO> {
    const role = (ctx.user.role ?? "user") as UserRole;
    const resolved = await dashboardTileService.resolveForUser(ctx);
    const enriched = await mapPool(resolved, 8, async (tile) => {
      const value = await valueForTile(ctx, tile.key);
      return toDto(tile, value);
    });

    const overview = enriched.filter((t) => isOverviewTile(t.key));
    const work = enriched.filter((t) => !isOverviewTile(t.key));

    const decidesAll = work.filter((t) => t.zone === "decides");
    const { decides, overflow } = trimDecidesZone(decidesAll, 3);
    const overflowWorklist = overflow.map((t) => ({ ...t, zone: "worklist" as const }));

    const worklistBase = work.filter((t) => t.zone === "worklist");
    const worklist = [...worklistBase, ...overflowWorklist].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const watch = work.filter((t) => t.zone === "watch").sort((a, b) => a.sortOrder - b.sortOrder);

    const allowedBand = new Set<"pruefung" | "behoerde" | "rueckruf">();
    for (const t of work) {
      if (!t.href) continue;
      const path = t.href.split("?")[0] ?? t.href;
      const g = BAND_FROM_HREF[path];
      if (g) allowedBand.add(g);
    }
    const band = await buildBand(startOfTodayUtc(), allowedBand);

    return {
      meta: {
        role,
        roleLabel: DASHBOARD_ROLE_LABELS[role] ?? role,
        workTileCount: work.length,
        overviewCount: overview.length,
        decidesPoolCount: decidesAll.length,
        overflowCount: overflow.length,
        worklistBaseCount: worklistBase.length,
        watchCount: watch.length,
      },
      overview,
      decides,
      worklist,
      watch,
      band,
    };
  },
};
