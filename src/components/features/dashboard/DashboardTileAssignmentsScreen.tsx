"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDashboardTileAssignments } from "@/components/hooks/dashboard/useDashboardTileAssignments";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isOverviewTile } from "@/constants/dashboardTiles";
import { USER_ROLES } from "@/constants/roles";
import type { UserRole } from "@/interfaces/session";
import { Badge } from "@/components/ui/badge";
import { useDashboardI18n } from "./useDashboardI18n";

export function DashboardTileAssignmentsScreen() {
  const t = useTranslations("pages.dashboard");
  const tCommon = useTranslations("common");
  const { roleLabel, tileTitle, tileQuestion } = useDashboardI18n();
  const a = useDashboardTileAssignments();

  if (!a.canView) {
    return (
      <AccessDenied
        title={t("assignments.title")}
        description={t("assignments.requiresRolesView")}
        hint={tCommon("contactAdmin")}
        testId="tile-assignments-denied"
      />
    );
  }

  const byZone = {
    decides: a.catalog.filter((tile) => tile.zone === "decides"),
    worklist: a.catalog.filter((tile) => tile.zone === "worklist"),
    watch: a.catalog.filter((tile) => tile.zone === "watch"),
  };

  return (
    <div className="p-work" data-testid="tile-assignments-page">
      <main className="p-main">
        <ListPageShell title={t("assignments.title")} description={t("assignments.description")}>
          <p className="mb-4 text-sm">
            <Link href="/dashboard" className="underline">
              {t("assignments.backDashboard")}
            </Link>
            {" · "}
            <Link href="/roles" className="underline">
              {t("assignments.rolesLink")}
            </Link>
          </p>

          <div className="mb-6 max-w-md space-y-2">
            <Label htmlFor="tile-role">{t("assignments.roleLabel")}</Label>
            <Select
              value={a.role ?? undefined}
              onValueChange={(v) => a.setRole(v as UserRole)}
            >
              <SelectTrigger id="tile-role" data-testid="tile-role-select">
                <SelectValue placeholder={t("assignments.rolePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!a.role ? (
            <p className="text-sm text-muted-foreground">{t("assignments.pickRole")}</p>
          ) : a.loading || !a.assignment ? (
            <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
          ) : (
            <div className="space-y-6">
              <div className="rounded-md border p-4">
                <p className="text-sm">
                  <strong>{roleLabel(a.assignment.role)}</strong>
                  <span className="text-muted-foreground">
                    {" "}
                    ·{" "}
                    {t("assignments.selectedCount", {
                      selected: a.draftKeys.size,
                      total: a.catalog.length,
                    })}
                  </span>
                </p>
              </div>

              {(["decides", "worklist", "watch"] as const).map((zone) => (
                <section key={zone} className="space-y-2">
                  <h2 className="text-sm font-semibold">{t(`zones.${zone}`)}</h2>
                  <ul className="space-y-2">
                    {byZone[zone].map((tile) => (
                      <li
                        key={tile.key}
                        className="flex items-start gap-2 rounded-md border p-3"
                      >
                        <Checkbox
                          checked={a.draftKeys.has(tile.key)}
                          disabled={!a.canUpdate}
                          onCheckedChange={(v) => a.toggleKey(tile.key, v === true)}
                          data-testid={`tile-check-${tile.key}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{tileTitle(tile)}</p>
                            {isOverviewTile(tile.key) ? (
                              <Badge variant="secondary">{t("assignments.overviewBadge")}</Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">{tileQuestion(tile)}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{tile.key}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {a.canUpdate ? (
                <Button
                  type="button"
                  onClick={() => void a.save()}
                  disabled={a.saving}
                  data-testid="tile-save"
                >
                  {a.saving ? t("assignments.saving") : t("assignments.save")}
                </Button>
              ) : null}
            </div>
          )}
        </ListPageShell>
      </main>
    </div>
  );
}
