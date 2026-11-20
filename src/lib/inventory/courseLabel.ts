/** Drop raw snapshot ids and organisation uuids from a device course line. */
export function readableCourseLabel(label: string): string {
  return label
    .replace(/\bsnapshot\s+\S+/gi, "classification update")
    .replace(/\s*[—–-]\s*org\s+[0-9a-f-]{32,36}/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Prefer clear import provenance wording for unit-event actions. */
export function courseLabelFromUnitEvent(action: string, note: string | null | undefined): string {
  const hint = note?.trim() || "";
  if (action === "imported") {
    return hint ? `Imported · ${hint}` : "Imported";
  }
  if (action === "import_updated") {
    return hint ? `Import update · ${hint}` : "Import update";
  }
  return readableCourseLabel(hint || action);
}
