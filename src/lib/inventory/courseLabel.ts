/** Drop raw snapshot ids and organisation uuids from a device course line. */
export function readableCourseLabel(label: string): string {
  return label
    .replace(/\bsnapshot\s+\S+/gi, "classification update")
    .replace(/\s*[—–-]\s*org\s+[0-9a-f-]{32,36}/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
