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
  visitCompletedAt: string | null;
  visitSequence: number | null;
  setupMinutes: number | null;
  secondVisitReason: string | null;
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
    const visitRow =
      siteRows.find((r) => r.visitId && r.visitStartedAt && !r.visitCompletedAt) ??
      siteRows.find((r) => r.visitId && r.visitStartedAt) ??
      siteRows.find((r) => r.visitId) ??
      null;

    groups.push({
      siteKey,
      siteId: first.siteId,
      siteName: first.siteName?.trim() || "—",
      accessHint: access,
      earliestDue: dues[0] ?? null,
      doneCount: siteRows.filter((r) => r.sealed).length,
      openCount: siteRows.filter((r) => !r.sealed).length,
      visitId: visitRow?.visitId ?? null,
      visitStartedAt: visitRow?.visitStartedAt ?? null,
      visitCompletedAt: visitRow?.visitCompletedAt ?? null,
      visitSequence: visitRow?.visitSequence ?? null,
      setupMinutes: visitRow?.setupMinutes ?? null,
      secondVisitReason: visitRow?.secondVisitReason ?? null,
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

/** E77 — send-ins are workshop jobs, not day-plan visit buckets. */
export function isSendInRow(row: CataloguePreviewDTO): boolean {
  return row.fulfilment === "send_in";
}

/** Visit started and not ended — keep the site card on Heute until End visit. */
export function isVisitStillOpen(row: CataloguePreviewDTO): boolean {
  return Boolean(row.visitId && row.visitStartedAt && !row.visitCompletedAt);
}

function dedupeByReference(rows: CataloguePreviewDTO[]): CataloguePreviewDTO[] {
  const map = new Map<string, CataloguePreviewDTO>();
  for (const row of rows) map.set(row.reference, row);
  return [...map.values()];
}

export function buildDaySections(
  open: CataloguePreviewDTO[],
  mode: "heute" | "woche" | "erledigt",
  done: CataloguePreviewDTO[] = [],
  today: Date = new Date(),
): InspectDaySection[] {
  if (mode === "erledigt") {
    const onSiteDone = done.filter((r) => !isSendInRow(r));
    return [
      {
        key: "heute",
        rows: onSiteDone,
        sites: groupRowsBySite(onSiteDone),
        done: true,
      },
    ];
  }

  const onSite = open.filter((r) => !isSendInRow(r));
  const bucketOf = (row: CataloguePreviewDTO) => tagesBucket(planDate(row), today);

  if (mode === "heute") {
    const openHeute = onSite.filter((r) => {
      const b = bucketOf(r);
      return b === "heute" || b === "ohne";
    });
    // Sealed jobs whose visit is still running stay on Heute so End visit remains available.
    const sealedActiveVisit = done.filter(
      (r) => !isSendInRow(r) && isVisitStillOpen(r),
    );
    const rows = dedupeByReference([...openHeute, ...sealedActiveVisit]);
    return [{ key: "heute", rows, sites: groupRowsBySite(rows) }];
  }

  const order: DayBucket[] = ["morgen", "woche", "spaeter"];
  return order.map((key) => {
    const rows = onSite.filter((r) => bucketOf(r) === key);
    return { key, rows, sites: groupRowsBySite(rows) };
  });
}
