"use client";

import { useTranslations } from "next-intl";
import { useUsersList } from "@/components/hooks/users/useUsersList";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { UsersTable } from "./users-table";

/** Superadmin user management — gated by users:* permission slugs. */
export function UsersScreen() {
  const t = useTranslations("pages.users");
  const tCommon = useTranslations("common");
  const list = useUsersList();

  if (!list.canView) {
    return (
      <AccessDenied
        title={t("title")}
        description={tCommon("denied")}
        hint={tCommon("contactAdmin")}
        testId="users-denied"
      />
    );
  }

  return (
    <div className="p-work" data-testid="users-page">
      <main className="p-main">
        <ListPageShell title={t("title")} description={t("description")}>
          <UsersTable list={list} />
        </ListPageShell>
      </main>
    </div>
  );
}
