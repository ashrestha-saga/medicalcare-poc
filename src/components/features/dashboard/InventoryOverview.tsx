"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DashboardSegmentTone, DashboardTileDTO, DashboardTileSegmentDTO } from "@/interfaces";
import { useDashboardI18n } from "./useDashboardI18n";

function toneClass(tone: DashboardSegmentTone): string {
  switch (tone) {
    case "ok":
      return "bg-[var(--green)]";
    case "warn":
      return "bg-[#9a7340]";
    case "info":
      return "bg-[var(--accent)]";
    default:
      return "bg-[var(--ink-faint)]/45";
  }
}

function segmentLabel(
  segment: DashboardTileSegmentDTO,
  t: ReturnType<typeof useDashboardI18n>["t"],
): string {
  const key = `overview.segments.${segment.key}` as const;
  return t.has(key) ? t(key) : segment.label;
}

function SegmentBar({
  segments,
  total,
  t,
}: {
  segments: DashboardTileSegmentDTO[];
  total: number;
  t: ReturnType<typeof useDashboardI18n>["t"];
}) {
  if (total <= 0 || segments.length === 0) return null;
  return (
    <TooltipProvider delayDuration={120}>
      <div
        className="mt-2 flex h-1.5 overflow-hidden rounded-sm bg-muted"
        role="img"
        aria-label={segments.map((s) => `${s.count} ${segmentLabel(s, t)}`).join(", ")}
      >
        {segments.map((s) => {
          const pct = Math.max(0.5, (s.count / total) * 100);
          const label = segmentLabel(s, t);
          return (
            <Tooltip key={s.key}>
              <TooltipTrigger asChild>
                <span
                  className={cn("h-full min-w-[2px] cursor-default", toneClass(s.tone))}
                  style={{ width: `${pct}%` }}
                  data-testid={`overview-seg-${s.key}`}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="font-mono text-[10px]">
                {s.count} {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function SegmentLegend({
  segments,
  t,
}: {
  segments: DashboardTileSegmentDTO[];
  t: ReturnType<typeof useDashboardI18n>["t"];
}) {
  if (segments.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-0.5">
      {segments.map((s) => (
        <li
          key={s.key}
          className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground"
        >
          <span className={cn("size-2 shrink-0 rounded-[2px]", toneClass(s.tone))} aria-hidden />
          <span className="tabular-nums text-foreground/80">{s.count}</span>
          <span>{segmentLabel(s, t)}</span>
        </li>
      ))}
    </ul>
  );
}

export function InventoryOverview({ tiles }: { tiles: DashboardTileDTO[] }) {
  const { t, formatDate, tileTitle, tileQuestion } = useDashboardI18n();
  if (tiles.length === 0) return null;
  const today = formatDate(new Date().toISOString());

  return (
    <Card className="shadow-none" data-testid="dashboard-overview">
      <CardHeader className="space-y-1 p-4 pb-0">
        <p className="text-[13.5px] font-semibold">{t("overview.title")}</p>
        <p className="font-mono text-[10px] text-muted-foreground">
          {t("overview.subtitle", { date: today })}
        </p>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tiles.map((tile) => {
            const segments = tile.segments ?? [];
            const total =
              tile.count ??
              (segments.length ? segments.reduce((sum, s) => sum + s.count, 0) : null);

            return (
              <div key={tile.key} className="min-w-0" data-testid={`overview-${tile.key}`}>
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {tileTitle(tile)}
                </p>
                <p className="mt-1.5 text-[21px] font-extrabold leading-none tracking-tight tabular-nums">
                  {total ?? "—"}
                </p>
                {total != null && segments.length > 0 ? (
                  <>
                    <SegmentBar segments={segments} total={total} t={t} />
                    <SegmentLegend segments={segments} t={t} />
                  </>
                ) : (
                  <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                    {tile.label || tile.hint || tileQuestion(tile)}
                  </p>
                )}
                {tile.href ? (
                  <Link
                    href={tile.href}
                    className="mt-1.5 inline-block text-[11.5px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    {t("tile.view")}
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-4 border-t border-border pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          {t("overview.footnote")}
        </p>
      </CardContent>
    </Card>
  );
}
