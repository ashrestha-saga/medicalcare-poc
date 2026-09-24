/** English chrome for product-kind picker (DB may still hold DE labels). Search blobs stay EN for both locales. */
const KIND_LABELS: Record<string, { label: string; hint: string; search: string }> = {
  bildgebung: {
    label: "Imaging with ionising radiation",
    hint: "X-ray, angiography, CT, mammography",
    search: "imaging ionising x-ray ct angiography mammography",
  },
  "therapie-strahlen": {
    label: "Radiotherapy",
    hint: "Accelerators, irradiation devices",
    search: "radiotherapy accelerator irradiation",
  },
  nuklear: {
    label: "Nuclear medicine",
    hint: "Gamma camera, PET, handling of radioactive substances",
    search: "nuclear medicine gamma pet radioactive",
  },
  sonografie: {
    label: "Sonography and diagnostic ultrasound",
    hint: "Ultrasound systems with probes",
    search: "sonography ultrasound diagnostic probe",
  },
  "aktiv-therapie": {
    label: "Active therapeutic or functional device",
    hint: "Ventilation, infusion, HF surgery, defibrillation, dialysis",
    search: "active therapeutic ventilation infusion defibrillation dialysis",
  },
  messgeraet: {
    label: "Device with a measuring function",
    hint: "Blood pressure, thermometers, tonometers, ergometers, dosimeters",
    search: "measuring blood pressure thermometer tonometer ergometer dosimeter",
  },
  aufbereitungsgeraet: {
    label: "Reprocessing machine",
    hint: "Washer-disinfector, autoclave, sealing device",
    search: "reprocessing autoclave washer disinfector sealing",
  },
  instrument: {
    label: "Reusable instrument or accessory",
    hint: "Instrument sets, endoscopes, probes",
    search: "reusable instrument endoscope accessory probe",
  },
  software: {
    label: "Software as a standalone device",
    hint: "Reporting software, SaMD, SaIVD",
    search: "software samd saivd standalone",
  },
  implantat: {
    label: "Implant under Anlage 3",
    hint: "Implantable products with documentation duty",
    search: "implant anlage 3 implantable",
  },
  sonstiges: {
    label: "Other device",
    hint: "All characteristics selectable individually",
    search: "other sonstiges",
  },
};

export type KindGroupKey = "imaging" | "active" | "reproc";

/** Map DB/API group strings (DE or EN) to translation keys under `registration.kindGroups`. */
export function kindGroupKey(group: string): KindGroupKey | null {
  if (/Bildgebung|Imaging/i.test(group)) return "imaging";
  if (/Aktive|Active/i.test(group)) return "active";
  if (/Aufbereitung|Reprocessing/i.test(group)) return "reproc";
  return null;
}

/** Preferred column count for kind grids by group. */
export function kindGroupColumns(group: string): 3 | 4 {
  return kindGroupKey(group) === "reproc" ? 4 : 3;
}

/** Fallback English group label when no translator is available. */
export function kindGroupLabel(group: string): string {
  const key = kindGroupKey(group);
  if (key === "imaging") return "Imaging and radiation";
  if (key === "active") return "Active devices and metrology";
  if (key === "reproc") return "Reprocessing, instruments, software";
  return group;
}

export function kindDisplay(code: string, fallbackLabel: string, fallbackHint: string | null) {
  const mapped = KIND_LABELS[code];
  return {
    label: mapped?.label ?? fallbackLabel,
    hint: mapped?.hint ?? fallbackHint ?? "",
  };
}

export function kindMatchesQuery(
  code: string,
  label: string,
  hint: string | null,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const mapped = KIND_LABELS[code];
  const blob = [code, label, hint ?? "", mapped?.label, mapped?.hint, mapped?.search]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return blob.includes(q);
}
