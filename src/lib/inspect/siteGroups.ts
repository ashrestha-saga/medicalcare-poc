import type { CataloguePreviewDTO } from "@/interfaces/pruefpartner";
import { planDate, tagesBucket, type DayBucket } from "./dayBuckets";

export type InspectSiteGroup = {
  siteKey: string;
  siteId: string | null;
  siteName: string;
  accessHint: string | null;
  earliestDue: string | null;
  doneCount: number;
  openCount: number;
  visitId: string | null;
  visitStartedAt: string | null;
  rows: CataloguePreviewDTO[];
};

export type InspectDaySection = {
  key: DayBucket;
  rows: CataloguePreviewDTO[];
  sites: InspectSiteGroup[];
  done?: boolean;
};

export function groupRowsBySite(rows: CataloguePreviewDTO[]): InspectSiteGroup[] {
  const map = new Map<string, CataloguePreviewDTO[]>();
  for (const row of rows) {
    const key = row.siteId ?? row.siteName ?? "__none__";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  const groups: InspectSiteGroup[] = [];
  for (const [siteKey, siteRows] of map) {
    const first = siteRows[0]!;
    const dues = siteRows
      .map((r) => r.dueAt)
      .filter((d): d is string => Boolean(d))
      .sort();
    const access =
      siteRows.map((r) => r.accessHint?.trim()).find((h) => h) ?? null;
    const visitStarted = siteRows
      .map((r) => r.visitStartedAt)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ?? null;
    const visitId =
      siteRows.find((r) => r.visitId && r.visitStartedAt)?.visitId ??
      siteRows.find((r) => r.visitId)?.visitId ??
      null;

    groups.push({
      siteKey,
      siteId: first.siteId,
      siteName: first.siteName?.trim() || "—",
      accessHint: access,
      earliestDue: dues[0] ?? null,
      doneCount: siteRows.filter((r) => r.sealed).length,
      openCount: siteRows.filter((r) => !r.sealed).length,
      visitId,
      visitStartedAt: visitStarted,
      rows: siteRows,
    });
  }

  return groups.sort((a, b) => {
    const da = a.earliestDue ?? "9999";
    const db = b.earliestDue ?? "9999";
    if (da !== db) return da.localeCompare(db);
    return a.siteName.localeCompare(b.siteName);
  });
}

export function buildDaySections(
  open: CataloguePreviewDTO[],
  mode: "heute" | "woche" | "erledigt",
  done: CataloguePreviewDTO[] = [],
): InspectDaySection[] {
  if (mode === "erledigt") {
    return [
      {
        key: "heute",
        rows: done,
        sites: groupRowsBySite(done),
        done: true,
      },
    ];
  }

  const bucketOf = (row: CataloguePreviewDTO) => tagesBucket(planDate(row));

  if (mode === "heute") {
    const rows = open.filter((r) => {
      const b = bucketOf(r);
      return b === "heute" || b === "ohne";
    });
    return [{ key: "heute", rows, sites: groupRowsBySite(rows) }];
  }

  const order: DayBucket[] = ["morgen", "woche", "spaeter"];
  return order.map((key) => {
    const rows = open.filter((r) => bucketOf(r) === key);
    return { key, rows, sites: groupRowsBySite(rows) };
  });
}
