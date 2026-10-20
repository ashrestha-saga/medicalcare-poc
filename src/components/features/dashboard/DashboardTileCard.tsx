"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { DashboardTileDTO, DashboardTileUrgency } from "@/interfaces";
import { useDashboardI18n } from "./useDashboardI18n";

function urgencyTone(u: DashboardTileUrgency): string {
  switch (u) {
    case "overdue":
      return "stop";
    case "due":
      return "warn";
    case "info":
      return "info";
    case "ok":
      return "ok";
    default:
      return "leer";
  }
}

function pickUnit(n: number, pair: string | null): string {
  if (!pair) return "";
  const [sing, plur] = pair.split("|");
  return n === 1 ? sing || plur || "" : plur || sing || "";
}

export function DashboardTileCard({ tile }: { tile: DashboardTileDTO }) {
  const { t, tileTitle, tileQuestion } = useDashboardI18n();
  const tone = urgencyTone(tile.urgency);
  const empty = tile.count === null;
  const meter =
    !empty && tile.denominator != null && tile.denominator > 0
      ? Math.max(0, Math.min(100, (tile.count! / tile.denominator) * 100))
      : null;
  const unit = pickUnit(tile.denominator ?? 0, tile.denominatorLabel);

  const body = (
    <Card
      className={cn(
        "dash-tile h-full shadow-none transition-colors hover:bg-muted/30",
        tone === "leer" && "border-dashed bg-muted/20",
      )}
      data-t={tone}
      data-testid={`tile-${tile.key}`}
    >
      <CardContent className="p-4">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          {tileTitle(tile)}
          {tile.dutyKey ? ` · ${tile.dutyKey}` : ""}
        </p>
        <p
          className={cn(
            "mt-2 text-[26px] font-extrabold leading-none tracking-tight tabular-nums",
            tone === "stop" && "text-[var(--red)]",
            tone === "warn" && "text-[var(--warn)]",
            tone === "ok" && "text-[var(--green)]",
            tone === "info" && "text-[var(--accent)]",
            tone === "leer" && "text-muted-foreground",
          )}
        >
          {empty ? "—" : tile.count}
        </p>
        {meter != null ? (
          <div className="mt-2.5 space-y-1">
            <Progress
              value={meter}
              className="h-1"
              indicatorClassName={cn(
                tone === "stop" && "bg-[var(--red)]",
                tone === "warn" && "bg-[var(--warn)]",
                tone === "ok" && "bg-[var(--green)]",
                tone === "info" && "bg-[var(--accent)]",
                !["stop", "warn", "ok", "info"].includes(tone) && "bg-muted-foreground",
              )}
              aria-label={t("tile.of", { count: tile.denominator!, unit })}
            />
            <p className="text-[10.5px] text-muted-foreground">
              {t("tile.of", { count: tile.denominator!, unit })}
            </p>
          </div>
        ) : null}
        <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
          {empty ? (
            <>
              <span className="font-semibold text-foreground">{t("tile.notRecorded")}</span>{" "}
              {tile.hint ?? ""}
            </>
          ) : (
            tile.label
          )}
        </p>
        <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">
          {tileQuestion(tile)}
        </p>
        {tile.href ? (
          <span className="mt-2 inline-block text-[12.5px] font-semibold text-[var(--accent)]">
            {t("tile.view")}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );

  return tile.href ? (
    <Link href={tile.href} className="block h-full focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
