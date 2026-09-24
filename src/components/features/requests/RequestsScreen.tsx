"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRequestsList } from "@/components/hooks/requests";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { RequestsTable } from "./requests-table";

/** Service request list — open a row to view `/requests/[reference]`. */
export function RequestsScreen() {
  const t = useTranslations("pages.requests");
  const router = useRouter();
  const list = useRequestsList();

  return (
    <div className="p-work" data-testid="requests-page">
      <main className="p-main">
        <ListPageShell title={t("title")} description={t("description")}>
          <RequestsTable
            list={list}
            onSelect={(request) => router.push(`/requests/${encodeURIComponent(request.reference)}`)}
          />
        </ListPageShell>
      </main>
    </div>
  );
}
