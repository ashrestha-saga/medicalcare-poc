"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ShopOrderSuccessSnapshot } from "@/components/hooks/cart/useShopOrderFlow";
import { Button } from "@/components/ui/button";

export function ShopOrderSuccess({
  success,
  inventoryHref,
  onDone,
}: {
  success: ShopOrderSuccessSnapshot;
  /** Capturer → scan home `/`; backoffice → `/devices`. */
  inventoryHref: string;
  onDone: () => void;
}) {
  const t = useTranslations("pages.shop.success");

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-2 py-10 text-center" data-testid="shop-order-success">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl font-semibold text-emerald-500"
        aria-hidden
      >
        ✓
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">{t("title")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>

      <dl className="mt-8 w-full space-y-3 rounded-lg border border-border bg-card px-4 py-4 text-left text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">{t("reference")}</dt>
          <dd className="font-mono font-medium tabular-nums" data-testid="shop-success-reference">
            {success.reference}
          </dd>
        </div>
        {success.externalOrderRef ? (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">{t("shopOrder")}</dt>
            <dd className="font-mono font-medium tabular-nums" data-testid="shop-success-shop-ref">
              {success.externalOrderRef}
            </dd>
          </div>
        ) : null}
        {success.orderedByName ? (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">{t("orderedBy")}</dt>
            <dd className="font-medium">{success.orderedByName}</dd>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
          <dt className="text-muted-foreground">{t("delivery")}</dt>
          <dd className="max-w-[60%] text-right font-medium whitespace-pre-line">{success.deliveryLabel}</dd>
        </div>
        {success.note ? (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">{t("note")}</dt>
            <dd className="max-w-[60%] text-right">{success.note}</dd>
          </div>
        ) : null}
        {success.totalLabel ? (
          <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
            <dt className="text-muted-foreground">{t("total")}</dt>
            <dd className="font-semibold tabular-nums" data-testid="shop-success-total">
              {success.totalLabel}
            </dd>
          </div>
        ) : null}
      </dl>

      {success.lines.length > 0 ? (
        <ul className="mt-4 w-full space-y-2 rounded-lg border border-border bg-card px-4 py-3 text-left text-sm">
          <li className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t("items", { count: success.itemCount })}
          </li>
          {success.lines.map((line) => (
            <li
              key={`${line.articleNumber}-${line.description}`}
              className="flex items-start justify-between gap-3 border-t border-border/60 pt-2 first:border-0 first:pt-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  <span className="mr-1.5 text-emerald-500" aria-hidden>
                    ✓
                  </span>
                  {line.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {line.articleNumber} · ×{line.quantity}
                </p>
              </div>
              {line.lineTotal ? <span className="shrink-0 tabular-nums">{line.lineTotal}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <Button type="button" className="mt-8 w-full sm:w-auto sm:min-w-[12rem]" asChild data-testid="shop-success-done">
        <Link href={inventoryHref} onClick={onDone}>
          {t("done")}
        </Link>
      </Button>
    </div>
  );
}
