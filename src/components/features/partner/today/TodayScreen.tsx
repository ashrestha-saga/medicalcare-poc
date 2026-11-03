"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/http/apiClient";
import type { PartnerBoardTile } from "@/services/console/partnerDashboardService";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useSessionStore } from "@/store/sessionStore";
import { cn } from "@/lib/utils";

type BoardPayload = {
  zones: {
    ent: PartnerBoardTile[];
    vor: PartnerBoardTile[];
    beob: PartnerBoardTile[];
  };
};

const WORK_VISIBLE = 6;

function TileCard({
  tile,
  label,
  detail,
  cta,
}: {
  tile: PartnerBoardTile;
  label: string;
  detail: string;
  cta: string;
}) {
  const samples = tile.samples ?? [];
  const more = tile.moreCount ?? 0;

  return (
    <Link
      href={tile.href}
      className={cn(
        "flex min-h-[148px] flex-col rounded-md border border-border bg-card p-3.5 shadow-sm transition hover:border-foreground/25",
      )}
      data-tone={tile.tone || undefined}
      data-testid={`partner-tile-${tile.id}`}
    >
      <span
        className={cn(
          "font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
          tile.tone === "stop" && "text-destructive",
          tile.tone === "warn" && "text-amber-700",
          (tile.tone === "ok" || tile.tone === "") && "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "mt-1.5 text-[28px] font-extrabold leading-none tracking-tight tabular-nums",
          tile.tone === "stop" && "text-destructive",
          tile.tone === "warn" && "text-amber-700",
          tile.tone === "ok" && "text-emerald-700",
        )}
      >
        {tile.display ?? tile.count}
      </span>
      <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{detail}</p>
      {samples.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-[11.5px] leading-snug text-foreground/85">
          {samples.map((line) => (
            <li key={line} className="truncate">
              {line}
            </li>
          ))}
          {more > 0 ? (
            <li className="text-muted-foreground">+{more}</li>
          ) : null}
        </ul>
      ) : null}
      <span className="mt-auto pt-3 text-[12.5px] font-semibold text-primary">{cta}</span>
    </Link>
  );
}

function Zone({
  title,
  hint,
  tiles,
  t,
  hiddenCount,
  onExpand,
}: {
  title: string;
  hint?: string;
  tiles: PartnerBoardTile[];
  t: ReturnType<typeof useTranslations<"console">>;
  hiddenCount?: number;
  onExpand?: () => void;
}) {
  if (tiles.length === 0) return null;
  return (
    <section className="mt-7">
      <h2 className="text-sm font-semibold text-foreground">
        {title}
        {hint ? <em className="ml-2 font-normal not-italic text-muted-foreground">{hint}</em> : null}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <TileCard
            key={tile.id}
            tile={tile}
            label={t(tile.labelKey as "tileOverdue")}
            detail={t(tile.detailKey as "tileOverdueDetail", tile.detailParams ?? {})}
            cta={t(tile.ctaKey as "tileOverdueCta")}
          />
        ))}
      </div>
      {hiddenCount && hiddenCount > 0 && onExpand ? (
        <Button type="button" variant="outline" size="sm" className="mt-3 h-8" onClick={onExpand}>
          {t("todayShowMore", { count: hiddenCount })}
        </Button>
      ) : null}
    </section>
  );
}

export function TodayScreen() {
  const t = useTranslations("console");
  const user = useSessionStore((s) => s.user);
  const { checkPermission } = usePermissions();
  const canAssignTiles = checkPermission("console:settings:view");
  const [zones, setZones] = useState<BoardPayload["zones"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workExpanded, setWorkExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api<BoardPayload>("/api/partner/dashboard/board");
        if (!cancelled) setZones(data.zones);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : t("todayLoadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const findings =
    zones?.ent.filter((x) => x.count > 0 && x.tone !== "ok").length ?? 0;

  const workTiles = zones?.vor ?? [];
  const visibleWork = workExpanded ? workTiles : workTiles.slice(0, WORK_VISIBLE);
  const hiddenWork = Math.max(0, workTiles.length - WORK_VISIBLE);

  const roleLabel = useMemo(() => {
    const role = user?.appRole;
    if (role === "management") return t("todayRoleManagement");
    if (role === "admin") return t("todayRoleAdmin");
    if (role === "service_lead") return t("todayRoleServiceLead");
    if (role === "inspector") return t("todayRoleInspector");
    if (role === "order") return t("todayRoleOrder");
    return t("todayRoleServiceLead");
  }, [t, user?.appRole]);

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    [],
  );

  const subtitle = t("todayRoleLine", {
    role: roleLabel,
    name: user?.name ?? "—",
    date: dateLabel,
  });

  return (
    <div className="p-work" data-testid="console-today">
      <main className="p-main">
        <ListPageShell
          title={t("todayTitle")}
          description={`${subtitle}. ${t("todayIntro")}`}
        >
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {loading ? <p className="text-sm text-muted-foreground">…</p> : null}
          {zones ? (
            <>
              <Zone
                title={t("todayZoneDecide")}
                hint={t("todayZoneDecideHint", { count: findings })}
                tiles={zones.ent}
                t={t}
              />
              <Zone
                title={t("todayZoneWork")}
                hint={
                  workTiles.length > 0
                    ? t("todayZoneWorkHint", {
                        shown: visibleWork.length,
                        total: workTiles.length,
                      })
                    : undefined
                }
                tiles={visibleWork}
                t={t}
                hiddenCount={!workExpanded ? hiddenWork : 0}
                onExpand={() => setWorkExpanded(true)}
              />
              <Zone title={t("todayZoneWatch")} tiles={zones.beob} t={t} />
              <p className="mt-8 rounded-md border border-border border-l-[3px] border-l-primary bg-muted/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                {t("todayNote")}
                {canAssignTiles ? (
                  <>
                    {" "}
                    <Link
                      href="/partner/today/assignments"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      data-testid="partner-tile-assign-link"
                    >
                      {t("todayTileAssignLink")}
                    </Link>
                  </>
                ) : null}
              </p>
            </>
          ) : null}
        </ListPageShell>
      </main>
    </div>
  );
}
