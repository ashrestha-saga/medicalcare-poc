"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DashboardBandGroupDTO } from "@/interfaces";
import { useDashboardI18n } from "./useDashboardI18n";

const MAX_SPAN = 365;
const DEFAULT_PAST = 30;
const DEFAULT_FUTURE = 90;
const STORAGE_KEY = "dashboard.bandRange";

type BandRange = { past: number; future: number };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeRange(raw: Partial<BandRange> | null): BandRange {
  const past = clamp(Math.round(Number(raw?.past) || DEFAULT_PAST), 0, MAX_SPAN);
  const future = clamp(Math.round(Number(raw?.future) || DEFAULT_FUTURE), 0, MAX_SPAN);
  return { past, future };
}

function axisMarks(past: number, future: number): number[] {
  const span = past + future || 1;
  const step = span <= 60 ? 15 : span <= 120 ? 30 : span <= 240 ? 60 : 90;
  const marks: number[] = [];
  for (let v = -Math.floor(past / step) * step; v <= future; v += step) {
    if (v >= -past && v <= future) marks.push(v);
  }
  if (!marks.includes(-past) && past > 0) marks.unshift(-past);
  if (!marks.includes(0)) marks.push(0);
  if (!marks.includes(future) && future > 0) marks.push(future);
  return [...new Set(marks)].sort((a, b) => a - b);
}

function stage(days: number): "stop" | "warn" | "info" {
  if (days < 0) return "stop";
  if (days <= 30) return "warn";
  return "info";
}

function stageDot(s: "stop" | "warn" | "info"): string {
  if (s === "stop") return "bg-[var(--red)]";
  if (s === "warn") return "bg-[var(--warn)]";
  return "bg-[var(--accent)]";
}

function stageText(s: "stop" | "warn" | "info"): string {
  if (s === "stop") return "text-[var(--red)]";
  if (s === "warn") return "text-[var(--warn)]";
  return "text-muted-foreground";
}

function BandRangeSlider({
  value,
  onChange,
  pastLabel,
  futureLabel,
  ariaLabel,
}: {
  value: BandRange;
  onChange: (next: BandRange) => void;
  pastLabel: string;
  futureLabel: string;
  ariaLabel: string;
}) {
  const id = useId();
  // Map dual extents onto one track: 0 = −365, 365 = today, 730 = +365
  const trackMax = MAX_SPAN * 2;
  const left = MAX_SPAN - value.past;
  const right = MAX_SPAN + value.future;
  const fillLeft = (left / trackMax) * 100;
  const fillWidth = ((right - left) / trackMax) * 100;

  return (
    <div className="w-full min-w-[12rem] max-w-md" aria-label={ariaLabel}>
      <div className="mb-1 flex justify-between font-mono text-[9px] text-muted-foreground">
        <span>{pastLabel}</span>
        <span>{futureLabel}</span>
      </div>
      <div className="relative h-6">
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--accent)]/50"
          style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-foreground/60"
          style={{ left: "50%" }}
          aria-hidden
        />
        <input
          id={`${id}-past`}
          type="range"
          min={0}
          max={trackMax}
          step={1}
          value={left}
          onChange={(e) => {
            const raw = Number(e.target.value);
            // Keep past thumb on/before today (track midpoint).
            const past = clamp(MAX_SPAN - Math.min(raw, MAX_SPAN), 0, MAX_SPAN);
            onChange({ past, future: value.future });
          }}
          className={cn(
            "band-range-thumb absolute inset-0 w-full appearance-none bg-transparent",
            value.past >= value.future ? "z-[4]" : "z-[2]",
          )}
          aria-label={pastLabel}
          data-testid="band-range-past"
        />
        <input
          id={`${id}-future`}
          type="range"
          min={0}
          max={trackMax}
          step={1}
          value={right}
          onChange={(e) => {
            const raw = Number(e.target.value);
            // Keep future thumb on/after today (track midpoint).
            const future = clamp(Math.max(raw, MAX_SPAN) - MAX_SPAN, 0, MAX_SPAN);
            onChange({ past: value.past, future });
          }}
          className={cn(
            "band-range-thumb absolute inset-0 w-full appearance-none bg-transparent",
            value.future > value.past ? "z-[4]" : "z-[3]",
          )}
          aria-label={futureLabel}
          data-testid="band-range-future"
        />
      </div>
    </div>
  );
}

export function DeadlineBand({ groups }: { groups: DashboardBandGroupDTO[] }) {
  const { t, formatDate } = useDashboardI18n();
  const [range, setRange] = useState<BandRange>({ past: DEFAULT_PAST, future: DEFAULT_FUTURE });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      setRange(normalizeRange(JSON.parse(raw) as Partial<BandRange>));
    } catch {
      /* ignore */
    }
  }, []);

  function chooseRange(next: BandRange) {
    const normalized = normalizeRange(next);
    setRange(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      /* ignore */
    }
  }

  const all = groups.flatMap((g) => g.points);
  if (all.length === 0) return null;

  const leftmost = -range.past;
  const rightmost = range.future;
  const span = rightmost - leftmost || 1;
  const x = (days: number) => ((clamp(days, leftmost, rightmost) - leftmost) / span) * 100;
  const marks = axisMarks(range.past, range.future);
  const earlier = all.filter((p) => p.days < leftmost).length;
  const later = all.filter((p) => p.days > rightmost).length;
  const inRange = (pts: typeof all) => pts.filter((p) => p.days >= leftmost && p.days <= rightmost);
  const todayLabel = formatDate(new Date().toISOString());

  return (
    <Card className="shadow-none" data-testid="dashboard-band">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 p-4 pb-0">
        <div>
          <p className="text-[13.5px] font-semibold">{t("band.title")}</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {t("band.subtitle", { count: all.length, date: todayLabel })}
          </p>
        </div>
        <div className="flex w-full max-w-md flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          <BandRangeSlider
            value={range}
            onChange={chooseRange}
            ariaLabel={t("band.horizonLabel")}
            pastLabel={t("band.rangePast", { days: range.past })}
            futureLabel={t("band.rangeFuture", { days: range.future })}
          />
          <div className="flex flex-wrap gap-3 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", stageDot("stop"))} /> {t("band.overdue")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", stageDot("warn"))} /> {t("band.within30")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", stageDot("info"))} /> {t("band.later")}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 p-4 pt-3">
        <div className="mb-1 flex items-end">
          <div className="hidden w-40 shrink-0 md:block" />
          <div className="relative h-4 flex-1">
            {marks.map((v) => (
              <span
                key={v}
                className={cn(
                  "absolute bottom-0 -translate-x-1/2 font-mono text-[9px] text-muted-foreground",
                  v === 0 && "font-semibold text-foreground",
                )}
                style={{ left: `${x(v).toFixed(1)}%` }}
              >
                {v === 0
                  ? t("band.today")
                  : v > 0
                    ? t("band.daysLater", { days: v })
                    : t("band.daysEarlier", { days: v })}
              </span>
            ))}
          </div>
          <div className="hidden w-24 shrink-0 md:block" />
        </div>

        <TooltipProvider delayDuration={150}>
          {groups.map((g) => {
            const pts = inRange(g.points);
            const overdue = pts.filter((p) => p.days < 0);
            const next = pts.find((p) => p.days >= 0);
            const labeled = new Set<string>();
            for (const p of overdue) labeled.add(`${p.date}|${p.label}`);
            if (next) labeled.add(`${next.date}|${next.label}`);
            const groupTitle = t(`band.groups.${g.key}`);
            const groupLater = g.points.filter((p) => p.days > rightmost).length;
            const groupEarlier = g.points.filter((p) => p.days < leftmost).length;

            return (
              <div key={g.key} className="flex flex-wrap items-center gap-0 md:flex-nowrap">
                <div className="w-full shrink-0 py-1 md:w-40 md:pr-3">
                  <p className="text-xs leading-tight">{groupTitle}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {g.points.length === 0
                      ? t("band.none")
                      : g.points.length === 1
                        ? t("band.appointmentOne")
                        : t("band.appointmentMany", { count: g.points.length })}
                  </p>
                </div>
                <div className="relative h-9 w-full flex-1 border-t border-border/60">
                  <div
                    className="absolute bottom-0 top-0 w-0.5 -translate-x-1/2 bg-foreground/50"
                    style={{ left: `${x(0).toFixed(1)}%` }}
                  />
                  {pts.length === 0 ? (
                    <span className="absolute left-0 top-2.5 font-mono text-[9.5px] text-muted-foreground">
                      {t("band.noDatesInRange")}
                    </span>
                  ) : null}
                  {pts.map((p, i) => {
                    const s = stage(p.days);
                    const left = `${x(p.days).toFixed(1)}%`;
                    const key = `${p.date}|${p.label}`;
                    const relative =
                      p.days < 0
                        ? t("band.daysOverdue", { days: Math.abs(p.days) })
                        : p.days === 0
                          ? t("band.today")
                          : t("band.inDays", { days: p.days });
                    return (
                      <span key={`${g.key}-${i}-${p.date}`} className="contents">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={p.href}
                              className={cn(
                                "absolute top-1.5 size-2.5 -translate-x-1/2 rounded-full border-2 border-card",
                                stageDot(s),
                              )}
                              style={{ left }}
                              aria-label={p.label}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs font-mono text-[10px]">
                            <p>{p.label}</p>
                            <p>
                              {formatDate(p.date)} · {relative}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        {labeled.has(key) ? (
                          <span
                            className={cn(
                              "pointer-events-none absolute top-5 -translate-x-1/2 bg-card px-0.5 font-mono text-[9px]",
                              stageText(s),
                              s === "stop" && "font-semibold",
                            )}
                            style={{ left }}
                          >
                            {formatDate(p.date)}
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
                <div className="hidden w-24 shrink-0 text-right font-mono text-[9px] text-muted-foreground md:block">
                  {groupLater
                    ? t("band.laterCount", { count: groupLater })
                    : groupEarlier
                      ? t("band.earlierCount", { count: groupEarlier })
                      : ""}
                </div>
              </div>
            );
          })}
        </TooltipProvider>

        {earlier > 0 || later > 0 ? (
          <p className="pt-2 font-mono text-[10px] text-muted-foreground">
            {t("band.beyondRange", {
              earlier,
              later,
              past: range.past,
              future: range.future,
            })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
