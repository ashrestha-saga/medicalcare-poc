"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DispositionScreen } from "@/components/features/partner/disposition/DispositionScreen";
import { InspectionOrdersScreen } from "@/components/features/partner/inspection-orders/InspectionOrdersScreen";
import { VisitsPanel } from "@/components/features/partner/visits/VisitsPanel";
import { cn } from "@/lib/utils";

type Tab = "disposition" | "visits" | "execution";

function OrdersTabs() {
  const t = useTranslations("console");
  const search = useSearchParams();
  const router = useRouter();
  const raw = search.get("tab");
  const tab: Tab =
    raw === "visits" || raw === "execution" || raw === "disposition" ? raw : "disposition";

  const tabs = useMemo(
    () =>
      [
        { id: "disposition" as const, label: t("ordersTabDisposition") },
        { id: "visits" as const, label: t("ordersTabVisits") },
        { id: "execution" as const, label: t("ordersTabExecution") },
      ] as const,
    [t],
  );

  return (
    <div className="p-work" data-testid="console-orders">
      <main className="p-main min-h-0 overflow-auto">
        <ListPageShell
          title={t("ordersTitle")}
          description={t("ordersIntro")}
          contentClassName="max-w-none pt-1"
        >
          <div
            className="mb-5 flex flex-wrap gap-1 border-b border-border"
            role="tablist"
            aria-label={t("ordersTitle")}
          >
            {tabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`orders-tab-${item.id}`}
                  className={cn(
                    "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "border-primary font-semibold text-foreground"
                      : "border-transparent font-medium text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => {
                    const next = new URLSearchParams();
                    next.set("tab", item.id);
                    const q = search.get("q");
                    if (q) next.set("q", q);
                    if (item.id === "disposition") {
                      for (const key of ["reason", "focus", "pipeline"] as const) {
                        const v = search.get(key);
                        if (v) next.set(key, v);
                      }
                    }
                    router.replace(`/partner/orders?${next.toString()}`);
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {tab === "disposition" ? <InspectionOrdersScreen embedded /> : null}
          {tab === "visits" ? <VisitsPanel embedded /> : null}
          {tab === "execution" ? <DispositionScreen embedded /> : null}
        </ListPageShell>
      </main>
    </div>
  );
}

export default function PartnerOrdersPage() {
  return (
    <Suspense fallback={<div className="p-work p-4 text-sm text-muted-foreground">…</div>}>
      <OrdersTabs />
    </Suspense>
  );
}
