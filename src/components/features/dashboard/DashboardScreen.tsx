"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { PageLoading } from "@/components/features/shared/PageLoading";
import { useDashboardBoard } from "@/components/hooks/dashboard/useDashboardBoard";
import { Button } from "@/components/ui/button";
import type { DashboardTileDTO } from "@/interfaces";
import { DeadlineBand } from "./DeadlineBand";
import { DashboardTileCard } from "./DashboardTileCard";
import { InventoryOverview } from "./InventoryOverview";

function Zone({ title, tiles }: { title: string; tiles: DashboardTileDTO[] }) {
  if (tiles.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-[15.5px] font-semibold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <DashboardTileCard key={t.key} tile={t} />
        ))}
      </div>
    </section>
  );
}

export function DashboardScreen() {
  const t = useTranslations("pages.dashboard");
  const tCommon = useTranslations("common");
  const { canView, board, loading, canManageTiles } = useDashboardBoard();

  if (!canView) {
    return (
      <AccessDenied
        title={t("title")}
        description={t("denied")}
        hint={tCommon("contactAdmin")}
        testId="dashboard-denied"
      />
    );
  }

  return (
    <div className="p-work" data-testid="dashboard-page">
      <main className="p-main">
        <ListPageShell
          variant="board"
          title={t("title")}
          description={t("description")}
          headerExtra={
            canManageTiles ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/assignments">{t("tileAssignments")}</Link>
              </Button>
            ) : null
          }
        >
          {loading || !board ? (
            <PageLoading label={tCommon("loading")} />
          ) : (
            <div className="space-y-6">
              <InventoryOverview tiles={board.overview} />
              <DeadlineBand groups={board.band} />
              <Zone title={t("zones.decides")} tiles={board.decides} />
              <Zone title={t("zones.worklist")} tiles={board.worklist} />
              <Zone title={t("zones.watch")} tiles={board.watch} />
            </div>
          )}
        </ListPageShell>
      </main>
    </div>
  );
}
