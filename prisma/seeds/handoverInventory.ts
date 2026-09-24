/**
 * Handover inventory seed — maps `data/devicecare-testdaten.sql` into existing
 * Prisma models only. All rows remapped to a single tenant (demo-tenant).
 *
 * Ignored (no Prisma model / out of POC scope):
 *   org.organisation*, membership, qualification, service_contract (seeded separately)
 *   svc.test_equipment
 *
 * Training: ops.person → clinic User (staff subject); ops.training_* → TrainingEvent/Record.
 */
import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeDutyDueAt } from "../../src/services/registration/dueDate";
import { hashPassword } from "../../src/lib/password";

const RULE_SET_BY_CODE: Record<string, string> = {
  MPBETREIBV: "rs-mpbetreibv",
  MPBETREIBV_ANNEX2: "rs-annex2",
  STRLSCHV: "rs-strlschv",
  KRINKO_BFARM: "rs-krinko",
  NORMEN: "rs-normen",
};

const DUTY_KEY_BY_INSPECTION: Record<string, string> = {
  MAINT: "wartung",
  STK: "stk",
  MTK: "mtk",
  ACCEPT: "abnahme",
  CONSTANCY: "konstanz",
  EXPERT: "sv",
  MEDBOARD: "aerztl",
  ITSEC: "itsec",
  INSTALL: "install",
  REPROC: "aufb",
  REPROC_CTRL: "aufb-ctrl",
  VALIDATION: "eigen-val",
  SINGLE_USE: "einmal",
  NETWORK: "netz",
  IMPLANT: "implant",
  RADIOACTIVE: "nuklear",
};

const IMPORTABLE = new Set([
  "ops.site",
  "ops.site_area",
  "ops.site_headcount",
  "ops.safety_officer_appointment",
  "ops.person",
  "ops.training_event",
  "ops.training_record",
  "cat.device_model",
  "cat.device_model_classification",
  "ops.device_unit",
  "ops.device_unit_event",
  "ops.device_release_snapshot",
  "ops.device_duty",
  "ops.duty_performance",
]);

type SqlRow = Record<string, unknown>;

function splitSqlList(s: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let inQ = false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" && depth === 0) {
      if (inQ && s[i + 1] === "'") {
        cur += "''";
        i += 1;
        continue;
      }
      inQ = !inQ;
      cur += c;
      continue;
    }
    if (!inQ) {
      if (c === "(") depth += 1;
      else if (c === ")") depth -= 1;
      else if (c === "," && depth === 0) {
        parts.push(cur.trim());
        cur = "";
        continue;
      }
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function unquote(raw: string): string {
  let s = raw.trim();
  if (s.endsWith("::jsonb") || s.endsWith("::text") || s.endsWith("::text[]")) {
    s = s.replace(/::(jsonb|text(?:\[\])?)$/, "");
  }
  if ((s.startsWith("DATE ") || s.startsWith("TIMESTAMPTZ ")) && s.includes("'")) {
    const m = s.match(/'([^']+)'/);
    return m ? m[1] : s;
  }
  if (s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

function parseSqlValue(raw: string): unknown {
  const s = raw.trim();
  if (s === "NULL") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);

  const annex = s.match(/\(SELECT id FROM ref\.annex2_item WHERE item_no='([^']+)'\)/i);
  if (annex) return { __annexItemNo: annex[1] };

  const rule = s.match(/\(SELECT id FROM ref\.rule_set WHERE code='([^']+)'\)/i);
  if (rule) return { __ruleSetCode: rule[1] };

  const arrRule = s.match(
    /^ARRAY\[\s*\(SELECT id FROM ref\.rule_set WHERE code='([^']+)'\)\s*\]$/i,
  );
  if (arrRule) return { __ruleSetCodes: [arrRule[1]] };

  const multiArr = s.match(/^ARRAY\[(.*)\]$/i);
  if (multiArr) {
    const inner = splitSqlList(multiArr[1]).map((v) => parseSqlValue(v));
    return inner;
  }

  return unquote(s);
}

function parseInserts(sql: string): Map<string, { cols: string[]; rows: SqlRow[] }> {
  const out = new Map<string, { cols: string[]; rows: SqlRow[] }>();
  const re =
    /INSERT INTO\s+([a-z_]+\.[a-z_]+)\s*\(([^)]+)\)\s*VALUES\s*\((.*)\)\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const table = m[1].toLowerCase();
    if (!IMPORTABLE.has(table)) continue;
    const cols = m[2].split(",").map((c) => c.trim());
    const vals = splitSqlList(m[3]).map(parseSqlValue);
    if (cols.length !== vals.length) {
      throw new Error(
        `Column/value mismatch for ${table}: ${cols.length} cols vs ${vals.length} vals`,
      );
    }
    const row: SqlRow = {};
    for (let i = 0; i < cols.length; i++) row[cols[i]] = vals[i];
    const bucket = out.get(table) ?? { cols, rows: [] };
    bucket.rows.push(row);
    out.set(table, bucket);
  }
  return out;
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return String(v);
}

function asBool(v: unknown): boolean {
  return v === true || v === "true";
}

function asInt(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Math.trunc(v);
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function asDate(v: unknown): Date | null {
  if (v == null) return null;
  const s = asString(v);
  if (!s) return null;
  // DATE 'YYYY-MM-DD' → already unquoted to YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveRuleSetId(v: unknown): string {
  if (v && typeof v === "object" && "__ruleSetCode" in v) {
    const code = (v as { __ruleSetCode: string }).__ruleSetCode;
    return RULE_SET_BY_CODE[code] ?? "rs-mpbetreibv";
  }
  if (typeof v === "string" && RULE_SET_BY_CODE[v]) return RULE_SET_BY_CODE[v];
  return "rs-mpbetreibv";
}

function resolveRuleSetIdsJson(v: unknown): string {
  if (v && typeof v === "object" && "__ruleSetCodes" in v) {
    const codes = (v as { __ruleSetCodes: string[] }).__ruleSetCodes;
    return JSON.stringify(codes.map((c) => RULE_SET_BY_CODE[c] ?? "rs-mpbetreibv"));
  }
  if (Array.isArray(v)) {
    return JSON.stringify(
      v.map((item) => {
        if (item && typeof item === "object" && "__ruleSetCode" in item) {
          const code = (item as { __ruleSetCode: string }).__ruleSetCode;
          return RULE_SET_BY_CODE[code] ?? "rs-mpbetreibv";
        }
        return "rs-mpbetreibv";
      }),
    );
  }
  return JSON.stringify(["rs-mpbetreibv"]);
}

function resolveAnnexId(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object" && v && "__annexItemNo" in v) {
    const itemNo = (v as { __annexItemNo: string }).__annexItemNo;
    return `annex2-MTK-${itemNo}`;
  }
  return null;
}

function jsonText(v: unknown, fallback: string): string {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      JSON.parse(v);
      return v;
    } catch {
      return JSON.stringify(v);
    }
  }
  return JSON.stringify(v);
}

function dutyKey(inspectionType: string, constancyObject: string | null): string {
  if (inspectionType === "CONSTANCY" && constancyObject) {
    return `konstanz-${constancyObject}`;
  }
  return DUTY_KEY_BY_INSPECTION[inspectionType] ?? inspectionType.toLowerCase();
}

function eventId(unitId: string, action: string, index: number): string {
  const h = createHash("sha1").update(`${unitId}|${action}|${index}`).digest("hex").slice(0, 24);
  return `hue-${h}`;
}

export type HandoverInventorySummary = {
  sites: number;
  areas: number;
  headcounts: number;
  safetyOfficers: number;
  staff: number;
  trainingEvents: number;
  trainingRecords: number;
  models: number;
  classifications: number;
  instances: number;
  events: number;
  snapshots: number;
  duties: number;
  performances: number;
};

export async function seedHandoverInventory(
  prisma: PrismaClient,
  tenantId: string,
): Promise<HandoverInventorySummary> {
  const sqlPath = join(process.cwd(), "data", "devicecare-testdaten.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const tables = parseInserts(sql);

  const sites = tables.get("ops.site")?.rows ?? [];
  const areas = tables.get("ops.site_area")?.rows ?? [];
  const headcounts = tables.get("ops.site_headcount")?.rows ?? [];
  const officers = tables.get("ops.safety_officer_appointment")?.rows ?? [];
  const models = tables.get("cat.device_model")?.rows ?? [];
  const classifications = tables.get("cat.device_model_classification")?.rows ?? [];
  const units = tables.get("ops.device_unit")?.rows ?? [];
  const events = tables.get("ops.device_unit_event")?.rows ?? [];
  const snapshots = tables.get("ops.device_release_snapshot")?.rows ?? [];
  const duties = tables.get("ops.device_duty")?.rows ?? [];
  const performances = tables.get("ops.duty_performance")?.rows ?? [];
  const persons = tables.get("ops.person")?.rows ?? [];
  const trainingEvents = tables.get("ops.training_event")?.rows ?? [];
  const trainingRecords = tables.get("ops.training_record")?.rows ?? [];

  for (const row of sites) {
    const id = asString(row.id)!;
    const code = asString(row.code);
    await prisma.site.upsert({
      where: { id },
      update: {
        tenantId,
        name: asString(row.name)!,
        code,
        address: asString(row.address),
        deliveryAddress: asString(row.goods_in),
      },
      create: {
        id,
        tenantId,
        name: asString(row.name)!,
        code,
        address: asString(row.address),
        deliveryAddress: asString(row.goods_in),
      },
    });
  }

  for (const row of areas) {
    const id = asString(row.id)!;
    await prisma.area.upsert({
      where: { id },
      update: {
        siteId: asString(row.site_id)!,
        name: asString(row.name)!,
      },
      create: {
        id,
        siteId: asString(row.site_id)!,
        name: asString(row.name)!,
      },
    });
  }

  const siteIds = sites.map((r) => asString(r.id)!);
  if (siteIds.length) {
    await prisma.siteHeadcount.deleteMany({ where: { siteId: { in: siteIds } } });
    await prisma.safetyOfficerAppointment.deleteMany({ where: { siteId: { in: siteIds } } });
  }

  for (const row of headcounts) {
    await prisma.siteHeadcount.create({
      data: {
        id: asString(row.id)!,
        siteId: asString(row.site_id)!,
        validFrom: asDate(row.valid_from)!,
        headcount: asInt(row.headcount)!,
        recordedBy: asString(row.recorded_by) ?? "Testdaten",
      },
    });
  }

  for (const row of officers) {
    await prisma.safetyOfficerAppointment.create({
      data: {
        id: asString(row.id)!,
        siteId: asString(row.site_id)!,
        personName: asString(row.person_name)!,
        functionalEmail: asString(row.functional_email),
        appointedFrom: asDate(row.appointed_from)!,
        appointedTo: asDate(row.appointed_to),
        publishedAt: asDate(row.published_at),
        documentRef: asString(row.document_ref),
      },
    });
  }

  for (const row of models) {
    const id = asString(row.id)!;
    await prisma.deviceModel.upsert({
      where: { id },
      update: {
        tradeName: asString(row.name),
        manufacturer: asString(row.manufacturer),
        modelName: asString(row.type_designation),
        productSeries: asString(row.product_series),
        riskClass: asString(row.mdr_risk_class),
        source: asString(row.source) ?? "manual",
        state: "released",
      },
      create: {
        id,
        tradeName: asString(row.name),
        manufacturer: asString(row.manufacturer),
        modelName: asString(row.type_designation),
        productSeries: asString(row.product_series),
        riskClass: asString(row.mdr_risk_class),
        source: asString(row.source) ?? "manual",
        state: "released",
      },
    });
  }

  // Clinic staff subjects (ops.person) — no intended login password.
  const staffHash = hashPassword("__staff_no_login__");
  const areaIds = new Set(areas.map((r) => asString(r.id)!));
  for (const row of persons) {
    const id = asString(row.id)!;
    const homeAreaId = asString(row.home_area_id);
    await prisma.user.upsert({
      where: { id },
      update: {
        tenantId,
        email: `staff-${id}@demo.local`,
        name: asString(row.display_name)!,
        role: "user",
        accountKind: "clinic",
        passwordHash: staffHash,
        active: asDate(row.employed_to) == null && asDate(row.anonymised_at) == null,
        jobTitle: asString(row.job_role),
        homeAreaId: homeAreaId && areaIds.has(homeAreaId) ? homeAreaId : null,
        employedFrom: asDate(row.employed_from),
        employedTo: asDate(row.employed_to),
        anonymisedAt: asDate(row.anonymised_at),
      },
      create: {
        id,
        tenantId,
        email: `staff-${id}@demo.local`,
        name: asString(row.display_name)!,
        role: "user",
        accountKind: "clinic",
        passwordHash: staffHash,
        active: asDate(row.employed_to) == null && asDate(row.anonymised_at) == null,
        jobTitle: asString(row.job_role),
        homeAreaId: homeAreaId && areaIds.has(homeAreaId) ? homeAreaId : null,
        employedFrom: asDate(row.employed_from),
        employedTo: asDate(row.employed_to),
        anonymisedAt: asDate(row.anonymised_at),
      },
    });
  }

  await prisma.trainingRecord.deleteMany({ where: { tenantId } });
  await prisma.trainingEvent.deleteMany({ where: { tenantId } });

  for (const row of trainingEvents) {
    const id = asString(row.id)!;
    const subjectModelId = asString(row.subject_model_id);
    const subjectActivity = asString(row.subject_activity);
    await prisma.trainingEvent.create({
      data: {
        id,
        tenantId,
        trainingTypeCode: asString(row.training_type)!,
        subjectModelId,
        subjectActivity,
        heldOn: asDate(row.held_on)!,
        location: asString(row.location),
        instructorName: asString(row.instructor_name)!,
        instructorQualification: asString(row.instructor_qualification)!,
        instructorExternal: asBool(row.instructor_external),
        basisDocument: asString(row.basis_document)!,
        mode: asString(row.mode) ?? "group",
        recordedBy: asString(row.recorded_by) ?? "Testdaten",
        recordedAt: new Date(),
      },
    });
  }

  for (const row of trainingRecords) {
    await prisma.trainingRecord.create({
      data: {
        id: asString(row.id)!,
        tenantId,
        eventId: asString(row.event_id)!,
        personId: asString(row.person_id)!,
        confirmedAt: new Date(),
        validUntil: asDate(row.valid_until),
      },
    });
  }

  for (const row of classifications) {
    const id = asString(row.id)!;
    const mtkItemId = resolveAnnexId(row.mtk_item_id);
    await prisma.deviceModelClassification.upsert({
      where: { id },
      update: {
        deviceModelId: asString(row.model_id)!,
        validFrom: asDate(row.valid_from) ?? new Date("2025-01-01T00:00:00.000Z"),
        validTo: asDate(row.valid_to),
        stk: asBool(row.stk),
        mtkItemId,
        radiation: asBool(row.radiation),
        softwareClass: asString(row.software_class),
        confidence: asString(row.confidence) ?? "derived",
        evidenceText: asString(row.evidence_text),
        ruleSetId: resolveRuleSetId(row.rule_set_id),
        confirmedBy: asString(row.confirmed_by),
        confirmedAt: asDate(row.confirmed_at),
      },
      create: {
        id,
        deviceModelId: asString(row.model_id)!,
        validFrom: asDate(row.valid_from) ?? new Date("2025-01-01T00:00:00.000Z"),
        validTo: asDate(row.valid_to),
        stk: asBool(row.stk),
        mtkItemId,
        radiation: asBool(row.radiation),
        softwareClass: asString(row.software_class),
        confidence: asString(row.confidence) ?? "derived",
        evidenceText: asString(row.evidence_text),
        ruleSetId: resolveRuleSetId(row.rule_set_id),
        confirmedBy: asString(row.confirmed_by),
        confirmedAt: asDate(row.confirmed_at),
      },
    });
  }

  const roots = units.filter((r) => r.parent_unit_id == null);
  const children = units.filter((r) => r.parent_unit_id != null);
  for (const row of [...roots, ...children]) {
    const id = asString(row.id)!;
    const purchaseYear = asInt(row.purchase_year);
    const commissionedAt =
      purchaseYear != null ? new Date(Date.UTC(purchaseYear, 0, 1)) : null;
    await prisma.deviceInstance.upsert({
      where: { id },
      update: {
        tenantId,
        inventoryNumber: asString(row.asset_no)!,
        serialNumber: asString(row.serial_no),
        udiDi: asString(row.udi_di),
        modelId: asString(row.model_id),
        areaId: asString(row.area_id),
        room: asString(row.room),
        commissionedAt,
        responsiblePerson: asString(row.responsible_person),
        productKindCode: asString(row.product_kind_code),
        state: asString(row.state) ?? "draft",
        source: asString(row.source) ?? "wizard",
        legacyMedgvGroup1: asBool(row.legacy_medgv_group1),
        aedExemption: asBool(row.aed_exemption),
        parentInstanceId: asString(row.parent_unit_id),
        retiredAt: asDate(row.retired_at),
        mergedIntoId: asString(row.merged_into_id),
      },
      create: {
        id,
        tenantId,
        inventoryNumber: asString(row.asset_no)!,
        serialNumber: asString(row.serial_no),
        udiDi: asString(row.udi_di),
        modelId: asString(row.model_id),
        areaId: asString(row.area_id),
        room: asString(row.room),
        commissionedAt,
        responsiblePerson: asString(row.responsible_person),
        productKindCode: asString(row.product_kind_code),
        state: asString(row.state) ?? "draft",
        source: asString(row.source) ?? "wizard",
        legacyMedgvGroup1: asBool(row.legacy_medgv_group1),
        aedExemption: asBool(row.aed_exemption),
        parentInstanceId: asString(row.parent_unit_id),
        retiredAt: asDate(row.retired_at),
        mergedIntoId: asString(row.merged_into_id),
      },
    });
  }

  const unitIds = units.map((r) => asString(r.id)!);
  if (unitIds.length) {
    await prisma.deviceUnitEvent.deleteMany({
      where: { deviceInstanceId: { in: unitIds }, actor: "Testdaten" },
    });
  }

  let eventIndex = 0;
  for (const row of events) {
    const unitId = asString(row.unit_id)!;
    const action = asString(row.action) ?? "create";
    await prisma.deviceUnitEvent.create({
      data: {
        id: eventId(unitId, action, eventIndex++),
        tenantId,
        deviceInstanceId: unitId,
        actor: asString(row.actor) ?? "Testdaten",
        action,
        toState: asString(row.to_state),
        note: asString(row.note),
      },
    });
  }

  for (const row of snapshots) {
    const id = asString(row.id)!;
    await prisma.deviceReleaseSnapshot.upsert({
      where: { id },
      update: {
        tenantId,
        deviceInstanceId: asString(row.unit_id)!,
        releasedBy: asString(row.released_by) ?? "Testdaten",
        ruleSetIds: resolveRuleSetIdsJson(row.rule_set_ids),
        classificationId: asString(row.classification_id),
        characteristics: jsonText(row.characteristics, "{}"),
        derivedDuties: jsonText(row.derived_duties, "[]"),
        prerequisites: jsonText(row.prerequisites, "{}"),
        appVersion: asString(row.app_version) ?? "testdaten-1.0",
      },
      create: {
        id,
        tenantId,
        deviceInstanceId: asString(row.unit_id)!,
        releasedBy: asString(row.released_by) ?? "Testdaten",
        ruleSetIds: resolveRuleSetIdsJson(row.rule_set_ids),
        classificationId: asString(row.classification_id),
        characteristics: jsonText(row.characteristics, "{}"),
        derivedDuties: jsonText(row.derived_duties, "[]"),
        prerequisites: jsonText(row.prerequisites, "{}"),
        appVersion: asString(row.app_version) ?? "testdaten-1.0",
      },
    });
  }

  for (const row of duties) {
    const id = asString(row.id)!;
    const inspectionType = asString(row.inspection_type)!;
    const constancyObject = asString(row.constancy_object);
    const referenceDate = asDate(row.reference_date)!;
    const intervalValue = asInt(row.interval_value);
    const intervalUnit = asString(row.interval_unit);
    const deadlineAnchor = asString(row.deadline_anchor)!;
    const dueAt = computeDutyDueAt({
      deadlineAnchor,
      referenceDate,
      intervalValue,
      intervalUnit,
    });

    await prisma.deviceDuty.upsert({
      where: { id },
      update: {
        tenantId,
        deviceInstanceId: asString(row.unit_id)!,
        snapshotId: asString(row.snapshot_id)!,
        dutyKey: dutyKey(inspectionType, constancyObject),
        inspectionTypeCode: inspectionType,
        deadlineAnchor,
        intervalValue,
        intervalUnit,
        cadenceLabel: asString(row.cadence_label),
        constancyObjectCode: constancyObject,
        basisText: asString(row.basis_text) ?? "",
        confidence: asString(row.confidence) ?? "derived",
        applicable: row.applicable == null ? true : asBool(row.applicable),
        notApplicableReason: asString(row.not_applicable_reason),
        referenceDate,
        dueAt,
        title: inspectionType,
      },
      create: {
        id,
        tenantId,
        deviceInstanceId: asString(row.unit_id)!,
        snapshotId: asString(row.snapshot_id)!,
        dutyKey: dutyKey(inspectionType, constancyObject),
        inspectionTypeCode: inspectionType,
        deadlineAnchor,
        intervalValue,
        intervalUnit,
        cadenceLabel: asString(row.cadence_label),
        constancyObjectCode: constancyObject,
        basisText: asString(row.basis_text) ?? "",
        confidence: asString(row.confidence) ?? "derived",
        applicable: row.applicable == null ? true : asBool(row.applicable),
        notApplicableReason: asString(row.not_applicable_reason),
        referenceDate,
        dueAt,
        title: inspectionType,
      },
    });
  }

  const dutyById = new Map(duties.map((d) => [asString(d.id)!, d]));

  for (const row of performances) {
    const id = asString(row.id)!;
    const dutyId = asString(row.duty_id)!;
    const performedAt = asDate(row.performed_on)!;
    const note = asString(row.condition_text);
    await prisma.dutyPerformance.upsert({
      where: { id },
      update: {
        tenantId,
        deviceDutyId: dutyId,
        performedAt,
        result: asString(row.result) ?? "passed",
        note,
        performedBy: asString(row.performed_by) ?? "Testdaten",
        source: "import",
      },
      create: {
        id,
        tenantId,
        deviceDutyId: dutyId,
        performedAt,
        result: asString(row.result) ?? "passed",
        note,
        performedBy: asString(row.performed_by) ?? "Testdaten",
        source: "import",
      },
    });

    const src = dutyById.get(dutyId);
    if (!src) continue;
    const referenceDate = asDate(src.reference_date);
    const deadlineAnchor = asString(src.deadline_anchor);
    if (!referenceDate || !deadlineAnchor) continue;

    await prisma.deviceDuty.update({
      where: { id: dutyId },
      data: {
        lastCompletedAt: performedAt,
        dueAt: computeDutyDueAt({
          deadlineAnchor,
          referenceDate,
          lastCompletedAt: performedAt,
          intervalValue: asInt(src.interval_value),
          intervalUnit: asString(src.interval_unit),
        }),
      },
    });
  }

  return {
    sites: sites.length,
    areas: areas.length,
    headcounts: headcounts.length,
    safetyOfficers: officers.length,
    staff: persons.length,
    trainingEvents: trainingEvents.length,
    trainingRecords: trainingRecords.length,
    models: models.length,
    classifications: classifications.length,
    instances: units.length,
    events: events.length,
    snapshots: snapshots.length,
    duties: duties.length,
    performances: performances.length,
  };
}
