/** Classification display labels matching catalog (ANNEX 1 / ANNEX 2 / SW … / STRLSCHV). */
export function inspectionTagsFromFlags(
  flags: {
    annex1?: boolean | null;
    annex2?: boolean | null;
    softwareClass?: string | null;
    radiation?: boolean | null;
  } | null | undefined,
): string[] {
  if (!flags) return [];
  const tags: string[] = [];
  if (flags.annex1 === true) tags.push("ANNEX 1");
  if (flags.annex2 === true) tags.push("ANNEX 2");
  if (flags.softwareClass) tags.push(`SW ${String(flags.softwareClass).toUpperCase()}`);
  if (flags.radiation === true) tags.push("STRLSCHV");
  return tags;
}
