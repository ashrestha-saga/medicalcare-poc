"use client";

import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { ActivityTable } from "@/components/features/audit/activity-table";
import { useAuditList } from "@/components/hooks/audit/useAuditList";

export function ActivityScreen() {
  const t = useTranslations("pages.activity");
  const tCommon = useTranslations("common");
  const list = useAuditList();

  if (!list.canView) {
    return (
      <AccessDenied
        title={t("title")}
        description={tCommon("denied")}
        hint={tCommon("contactAdmin")}
        testId="activity-denied"
      />
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
