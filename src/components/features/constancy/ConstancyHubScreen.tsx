"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ConstancyIntervalsPanel } from "@/components/features/constancy/ConstancyIntervalsPanel";
import { ConstancyRoutineScreen } from "@/components/features/constancy/ConstancyRoutineScreen";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { useConstancyCadence } from "@/components/hooks/constancy/useConstancyCadence";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { cn } from "@/lib/utils";

type HubTab = "intervals" | "routine";

/**
 * Mockup „Strahlenschutz · Konstanzprüfungen“:
 * one page with Intervals (takt) + Routine tabs.
 */
export function ConstancyHubScreen() {
  const t = useTranslations("pages.constancyHub");
  const { checkPermission, permissionsLoading } = usePermissions();
  const canView = checkPermission("duties:view");
  const list = useConstancyCadence();
  const { sync } = useSyncQueryParams();
  const tabParam = useQueryParam("tab");
  const section = useQueryParam("section");

  const tab: HubTab = useMemo(() => {
    if (tabParam === "routine") return "routine";
    if (section === "missing") return "intervals";
    if (tabParam === "intervals") return "intervals";
    return "intervals";
  }, [tabParam, section]);

  const setTab = (next: HubTab) => {
    if (next === "routine") {
      sync({ tab: "routine" }, { dropKeys: ["section"] });
      return;
    }
    sync({ tab: "intervals", section: section === "missing" ? "missing" : null });
  };

  if (permissionsLoading) {
    return (
      <div className="p-work" data-testid="constancy-hub-loading">
        <main className="p-main">
          <ListPageShell title={t("title")}>
            <p className="text-sm text-muted-foreground">…</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  if (!canView) {
    return <AccessDenied title={t("title")} testId="constancy-hub-denied" />;
  }

  const missingCount = list.missing.length;

  return (
    <div className="p-work" data-testid="constancy-cadence-page">
      <main className="p-main">
        <ListPageShell title={t("title")} description={t("description")}>
          <div
            className="mb-4 flex flex-wrap gap-1"
            role="tablist"
            aria-label={t("tabsAria")}
            data-testid="constancy-hub-tabs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "intervals"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "intervals"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
              data-testid="constancy-tab-intervals"
              onClick={() => setTab("intervals")}
            >
              {t("tabIntervals")}
              {missingCount > 0 ? (
                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                    tab === "intervals" ? "bg-white/20 text-white" : "bg-amber-600 text-white",
                  )}
                >
                  {missingCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "routine"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "routine"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
              data-testid="constancy-tab-routine"
              onClick={() => setTab("routine")}
            >
              {t("tabRoutine")}
            </button>
          </div>

          {tab === "intervals" ? (
            <ConstancyIntervalsPanel list={list} />
          ) : (
            <ConstancyRoutineScreen
              embedded
              onNeedCadence={() => {
                sync({ tab: "intervals", section: "missing" });
              }}
            />
          )}
        </ListPageShell>
      </main>
    </div>
  );
}
