"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useShopOrdersList } from "@/components/hooks/shop-orders/useShopOrdersList";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShopOrdersSummary } from "./ShopOrdersSummary";
import { ShopOrdersTable } from "./shop-orders-table";

export function ShopOrdersScreen() {
  const t = useTranslations("pages.shopOrders");
  const router = useRouter();
  const list = useShopOrdersList();

  return (
    <div className="p-work" data-testid="shop-orders-page">
      <main className="p-main">
        <ListPageShell title={t("title")} description={t("description")} testId="shop-orders-screen">
          {list.error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{list.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-4">
            <ShopOrdersSummary
              summary={list.summary}
              filter={list.filter}
              onFilter={list.setFilter}
            />
            <ShopOrdersTable
              list={list}
              onSelect={(order) => router.push(`/shop-orders/${encodeURIComponent(order.reference)}`)}
            />
          </div>
        </ListPageShell>
      </main>
    </div>
  );
}
