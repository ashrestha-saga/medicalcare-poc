/**
 * Classification metadata for RefTestEquipmentClass codes.
 * Labels come from the DB ref; purpose/usedFor copy lives in i18n
 * (`pruefpartner.equipmentClass_<code>_purpose` / `_usedFor`).
 */

export const TEST_EQUIPMENT_CLASS_GROUPS = [
  "electrical",
  "vitals",
  "imaging",
  "specialty",
  "general",
] as const;

export type TestEquipmentClassGroup = (typeof TEST_EQUIPMENT_CLASS_GROUPS)[number];

export type TestEquipmentClassMeta = {
  code: string;
  group: TestEquipmentClassGroup;
};

/** Stable order for the ⓘ guide. Unknown DB codes fall to the end under general. */
export const TEST_EQUIPMENT_CLASS_META: readonly TestEquipmentClassMeta[] = [
  { code: "sicherheitstester", group: "electrical" },
  { code: "multimeter", group: "electrical" },
  { code: "nibp_sim", group: "vitals" },
  { code: "temp_normal", group: "vitals" },
  { code: "schwarzkoerper", group: "vitals" },
  { code: "audio_kal", group: "specialty" },
  { code: "tonometer_pruefkoerper", group: "specialty" },
  { code: "ergometer_normal", group: "specialty" },
  { code: "roentgen_pruefkoerper", group: "imaging" },
  { code: "monitor_testbild", group: "imaging" },
  { code: "dosimeter_normal", group: "imaging" },
];

export const TEST_EQUIPMENT_CLASS_META_BY_CODE: ReadonlyMap<string, TestEquipmentClassMeta> = new Map(
  TEST_EQUIPMENT_CLASS_META.map((m) => [m.code, m]),
);

export type TestEquipmentStatus = "ok" | "due" | "lapsed" | "inactive";

const DUE_SOON_DAYS = 30;

export function deriveTestEquipmentStatus(
  active: boolean,
  calibratedUntil: Date | string | null,
  now = new Date(),
): TestEquipmentStatus {
  if (!active) return "inactive";
  if (!calibratedUntil) return "ok";
  const until =
    typeof calibratedUntil === "string"
      ? new Date(`${calibratedUntil.slice(0, 10)}T00:00:00`)
      : new Date(calibratedUntil);
  if (Number.isNaN(until.getTime())) return "ok";
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (until < start) return "lapsed";
  const dueLimit = new Date(start);
  dueLimit.setDate(dueLimit.getDate() + DUE_SOON_DAYS);
  if (until <= dueLimit) return "due";
  return "ok";
}
