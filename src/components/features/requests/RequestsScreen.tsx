"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRequestsList } from "@/components/hooks/requests";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { RequestsTable } from "./requests-table";

/** Service request list — open a row to view `/requests/[reference]`. */
export function RequestsScreen() {
  const t = useTranslations("pages.requests");
  const router = useRouter();
  const list = useRequestsList();
  const { checkPermission } = usePermissions();
  const canReportFault = checkPermission("requests:create");
  const canRecordExternal =
    checkPermission("inventory:update") || checkPermission("requests:approve");

  return (
    <div className="p-work" data-testid="requests-page">
      <main className="p-main">
        <ListPageShell
          title={t("title")}
          description={t("description")}
          headerExtra={
            canReportFault || canRecordExternal ? (
              <div className="flex flex-wrap justify-end gap-2" data-testid="requests-repair-actions">
                {canReportFault ? (
                  <Button type="button" size="sm" asChild data-testid="requests-report-fault">
                    <Link href="/fault-report">{t("reportFault")}</Link>
                  </Button>
                ) : null}
                {canRecordExternal ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    asChild
                    data-testid="requests-record-external"
                  >
                    <Link href="/maintenance-events/new">{t("recordExternal")}</Link>
                  </Button>
                ) : null}
                {checkPermission("requests:approve") ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    asChild
                    data-testid="requests-sv-certificate"
                  >
                    <Link href="/requests/sv-certificate">{t("svCertificate")}</Link>
                  </Button>
                ) : null}
              </div>
            ) : undefined
          }
        >
          <RequestsTable
            list={list}
            onSelect={(request) => router.push(`/requests/${encodeURIComponent(request.reference)}`)}
          />
        </ListPageShell>
      </main>
    </div>
  );
}
