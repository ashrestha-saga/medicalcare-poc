"use client";

import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { ActivityTable } from "@/components/features/audit/activity-table";
import { useAuditList } from "@/components/hooks/audit/useAuditList";

export function ActivityScreen() {
  const t = useTranslations("pages.activity");
  const tCommon = useTranslations("common");
  const list = useAuditList();

  if (!list.canView) {
    return (
      <div className="p-work" data-testid="activity-denied">
        <main className="p-main">
          <ListPageShell title={t("title")} description={tCommon("denied")}>
            <p className="text-sm text-muted-foreground">{tCommon("contactAdmin")}</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="activity-page">
      <main className="p-main">
        <ListPageShell title={t("title")} description={t("description")}>
          <ActivityTable list={list} />
        </ListPageShell>
      </main>
    </div>
  );
}
