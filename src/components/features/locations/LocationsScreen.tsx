"use client";

import { useTranslations } from "next-intl";
import { useLocationsList } from "@/components/hooks/locations/useLocationsList";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { LocationsTable } from "./locations-table";

/** Superadmin clinic site management — gated by locations:* permission slugs. */
export function LocationsScreen() {
  const t = useTranslations("pages.locations");
  const tCommon = useTranslations("common");
  const list = useLocationsList();

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="locations-denied">
        <main className="p-main">
          <ListPageShell title={t("title")} description={tCommon("denied")}>
            <p className="text-sm text-muted-foreground">{tCommon("contactAdmin")}</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="locations-page">
      <main className="p-main">
        <ListPageShell title={t("title")} description={t("description")}>
          <LocationsTable list={list} />
        </ListPageShell>
      </main>
    </div>
  );
}
