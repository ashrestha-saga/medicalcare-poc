"use client";

import { useTranslations } from "next-intl";
import type { OrderRequestDTO } from "@/interfaces";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useShopOrdersColumns } from "@/components/hooks/shop-orders/useShopOrdersColumns";
import { useShopOrdersList } from "@/components/hooks/shop-orders/useShopOrdersList";

type ListApi = ReturnType<typeof useShopOrdersList>;

export function ShopOrdersTable({
  list,
  onSelect,
}: {
  list: ListApi;
  onSelect: (order: OrderRequestDTO) => void;
}) {
  const t = useTranslations("pages.shopOrders");
  const columns = useShopOrdersColumns(onSelect);

  return (
    <div data-testid="shop-orders-table">
      <DataTable
        data={list.orders}
        columns={columns}
        search
        visibility
        displayPagination
        isLoading={list.loading}
        totalItems={list.orders.length}
        getRowId={(row) => row.id}
        emptyMessage={t("empty")}
        searchPlaceholder={t("searchPlaceholder")}
        onRowClick={onSelect}
      />
    </div>
  );
}
