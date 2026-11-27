"use client";

import { useTranslations } from "next-intl";
import type { ShopOrdersSummaryDTO } from "@/interfaces";
import type { ShopOrdersFilter } from "@/components/hooks/shop-orders/useShopOrdersList";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function SummaryCard({
  label,
  value,
  hint,
  tone,
  active,
  onClick,
  testId,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "warning" | "default";
  active?: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left" data-testid={testId}>
      <Card
        className={cn(
          "h-full shadow-none transition-colors",
          active ? "border-foreground/40 bg-muted/40" : "bg-card",
        )}
      >
        <CardContent className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-semibold tabular-nums",
              tone === "warning" ? "text-amber-700 dark:text-amber-400" : "text-foreground",
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </button>
  );
}

export function ShopOrdersSummary({
  summary,
  filter,
  onFilter,
}: {
  summary: ShopOrdersSummaryDTO;
  filter: ShopOrdersFilter;
  onFilter: (filter: ShopOrdersFilter) => void;
}) {
  const t = useTranslations("pages.shopOrders.cards");

  /** Click active card again to clear; Total always clears to all. */
  const select = (next: ShopOrdersFilter) => {
    onFilter(filter === next ? "all" : next);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="shop-orders-summary">
      <SummaryCard
        label={t("total")}
        value={summary.total}
        hint={t("totalHint")}
        active={filter === "all"}
        onClick={() => select("all")}
        testId="shop-orders-card-total"
      />
      <SummaryCard
        label={t("ordered")}
        value={summary.ordered}
        hint={t("orderedHint")}
        active={filter === "ordered"}
        onClick={() => select("ordered")}
        testId="shop-orders-card-ordered"
      />
      <SummaryCard
        label={t("shipped")}
        value={summary.shipped}
        hint={t("shippedHint")}
        active={filter === "shipped"}
        onClick={() => select("shipped")}
        testId="shop-orders-card-shipped"
      />
      <SummaryCard
        label={t("failed")}
        value={summary.failed}
        hint={t("failedHint")}
        tone={summary.failed > 0 ? "warning" : "default"}
        active={filter === "failed"}
        onClick={() => select("failed")}
        testId="shop-orders-card-failed"
      />
    </div>
  );
}
