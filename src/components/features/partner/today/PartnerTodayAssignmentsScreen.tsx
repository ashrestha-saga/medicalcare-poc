"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PARTNER_TODAY_TILE_CATALOG,
  type PartnerTileZone,
} from "@/constants/partnerConsoleNav";
import { KNOWN_PARTNER_APP_ROLES } from "@/constants/partnerPermissions";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import type { PartnerAppRole } from "@/interfaces/management";
import { cn } from "@/lib/utils";

const ZONE_ORDER: PartnerTileZone[] = ["ent", "vor", "beob"];

function roleLabelKey(
  role: PartnerAppRole,
): "staffRoleAdmin" | "staffRoleServiceLead" | "staffRoleManagement" | "staffRoleInspector" | "staffRoleOrder" {
  if (role === "admin") return "staffRoleAdmin";
  if (role === "service_lead") return "staffRoleServiceLead";
  if (role === "management") return "staffRoleManagement";
  if (role === "order") return "staffRoleOrder";
  return "staffRoleInspector";
}

function zoneTitleKey(zone: PartnerTileZone): "todayZoneDecide" | "todayZoneWork" | "todayZoneWatch" {
  if (zone === "ent") return "todayZoneDecide";
  if (zone === "vor") return "todayZoneWork";
  return "todayZoneWatch";
}

/** Read-only v14-A Heute tile matrix by partner app role (catalog presets). */
export function PartnerTodayAssignmentsScreen() {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const { checkPermission } = usePermissions();
  const canView = checkPermission("console:settings:view");
  const [role, setRole] = useState<PartnerAppRole>("service_lead");

  const selected = useMemo(() => {
    const keys = new Set(
      PARTNER_TODAY_TILE_CATALOG.filter((tile) => tile.roles.includes(role)).map((tile) => tile.id),
    );
    return keys;
  }, [role]);

  if (!canView) {
    return (
      <AccessDenied
        title={t("tileAssignTitle")}
        description={t("tileAssignDenied")}
        hint={tCommon("contactAdmin")}
        testId="partner-tile-assignments-denied"
      />
    );
  }

  return (
    <div className="p-work" data-testid="partner-tile-assignments">
      <main className="p-main">
        <ListPageShell title={t("tileAssignTitle")} description={t("tileAssignIntro")}>
          <p className="mb-4 text-sm">
            <Link href="/partner/today" className="text-primary underline-offset-4 hover:underline">
              ← {t("tileAssignBack")}
            </Link>
          </p>

          <div className="mb-6 max-w-md space-y-2">
            <label htmlFor="partner-tile-role" className="text-sm font-medium">
              {t("staffRole")}
            </label>
            <Select value={role} onValueChange={(v) => setRole(v as PartnerAppRole)}>
              <SelectTrigger id="partner-tile-role" data-testid="partner-tile-role-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KNOWN_PARTNER_APP_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(roleLabelKey(r))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            {t("tileAssignSelected", {
              selected: selected.size,
              total: PARTNER_TODAY_TILE_CATALOG.length,
              role: t(roleLabelKey(role)),
            })}
          </p>

          <div className="space-y-6">
            {ZONE_ORDER.map((zone) => {
              const tiles = PARTNER_TODAY_TILE_CATALOG.filter((tile) => tile.zone === zone);
              if (tiles.length === 0) return null;
              return (
                <section key={zone} className="rounded-md border border-border p-4">
                  <h2 className="mb-3 text-sm font-semibold">{t(zoneTitleKey(zone))}</h2>
                  <ul className="space-y-2">
                    {tiles.map((tile) => {
                      const on = selected.has(tile.id);
                      return (
                        <li
                          key={tile.id}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm",
                            on ? "bg-muted/60" : "opacity-55",
                          )}
                          data-testid={`partner-tile-row-${tile.id}`}
                        >
                          <span className="min-w-0 truncate">
                            {t(tile.labelKey as "tileOverdue")}
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                              {tile.id}
                            </span>
                          </span>
                          <Badge variant={on ? "default" : "outline"}>
                            {on ? t("tileAssignOn") : t("tileAssignOff")}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{t("tileAssignNote")}</p>
        </ListPageShell>
      </main>
    </div>
  );
}
