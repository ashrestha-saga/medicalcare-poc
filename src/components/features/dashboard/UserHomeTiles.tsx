"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardBoardDTO, DashboardTileDTO } from "@/interfaces";
import { api } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { DashboardTileCard } from "./DashboardTileCard";
import { useDashboardI18n } from "./useDashboardI18n";

const P3_KEYS = new Set(["meine-geraete", "meine-einweisungen", "stoerung-melden", "gesperrte-geraete"]);

/**
 * P3 Anwenderin tiles on `/` for role `user` (no shell:nav).
 * Composes above the scan workflow without replacing it.
 */
export function UserHomeTiles() {
  const { t } = useDashboardI18n();
  const { checkPermission, permissionData } = usePermissions();
  const isUserHome =
    !checkPermission("shell:nav") &&
    checkPermission("inventory:view") &&
    permissionData?.role === "user";
  const [tiles, setTiles] = useState<DashboardTileDTO[]>([]);

  const load = useCallback(async () => {
    if (!isUserHome) {
      setTiles([]);
      return;
    }
    try {
      const board = await api<DashboardBoardDTO>("/api/dashboard/board");
      const all = [...board.overview, ...board.decides, ...board.worklist, ...board.watch].filter(
        (tile) => P3_KEYS.has(tile.key),
      );
      setTiles(all);
    } catch {
      setTiles([]);
    }
  }, [isUserHome]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isUserHome || tiles.length === 0) return null;

  return (
    <section className="mb-4 space-y-2" data-testid="user-home-tiles">
      <h2 className="text-sm font-semibold">{t("userHome.title")}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {tiles.map((tile) => (
          <DashboardTileCard key={tile.key} tile={tile} />
        ))}
      </div>
    </section>
  );
}
