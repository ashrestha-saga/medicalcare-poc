"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useShopOrderDetail } from "@/components/hooks/shop-orders/useShopOrderDetail";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Spinner } from "@/components/ui/Loading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderRequestDTO } from "@/interfaces";
import { formatMoney } from "@/lib/cart";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";

function stateVariant(state: string | undefined): "default" | "secondary" | "destructive" | "outline" {
  if (state === "ordered" || state === "shipped") return "default";
  if (state === "failed" || state === "cancelled" || state === "expired") return "destructive";
  if (state === "submitting") return "secondary";
  return "outline";
}

export function ShopOrderDetailScreen({ reference }: { reference: string }) {
  const t = useTranslations("pages.shopOrders.detail");
  const tStatus = useTranslations("shopOrderStatus");
  const locale = useLocale() as AppLocale;
  const { order, loading, error } = useShopOrderDetail(reference);

  return (
    <div className="p-work" data-testid="shop-order-detail-page">
      <main className="p-main">
        <ListPageShell
          title={order ? t("title", { reference: order.reference }) : t("loadingTitle")}
          description={t("description")}
          testId="shop-order-detail-screen"
          headerExtra={
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/shop-orders">{t("back")}</Link>
            </Button>
          }
        >
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {!loading && order ? (
            <div className="space-y-4" data-testid="shop-order-detail">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={stateVariant(order.externalState)}>
                  {tStatus((order.externalState ?? "intent") as "ordered")}
                </Badge>
                {order.externalOrderRef ? (
                  <span className="text-sm text-muted-foreground">
                    {t("shopRef", { ref: order.externalOrderRef })}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Card className="border-border shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t("overview")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Row label={t("reference")} value={order.reference} />
                    <Row label={t("shopOrder")} value={order.externalOrderRef ?? "—"} />
                    <Row label={t("shopOrderId")} value={order.externalOrderId ?? "—"} />
                    <div className="flex justify-between gap-4" data-testid="shop-order-device-row">
                      <dt className="text-muted-foreground">{t("device")}</dt>
                      <dd className="text-right text-foreground">
                        {order.device ? (
                          <Link
                            href={order.device.href}
                            className="font-medium underline-offset-2 hover:underline"
                          >
                            {order.device.label}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <Row
                      label={t("purpose")}
                      value={
                        order.purpose === "device"
                          ? t("purposeDevice")
                          : t("purposeParts")
                      }
                    />
                    {order.device ? (
                      <Row label={t("inventoryNumber")} value={order.device.inventoryNumber} />
                    ) : null}
                    <Row label={t("orderedBy")} value={order.orderedByName ?? "—"} />
                    <Row label={t("raisedBy")} value={order.raisedBy ?? "—"} />
                    <Row
                      label={t("created")}
                      value={formatDateTime(order.createdAt, locale)}
                    />
                    <Row
                      label={t("updated")}
                      value={order.updatedAt ? formatDateTime(order.updatedAt, locale) : "—"}
                    />
                  </CardContent>
                </Card>

                <Card className="border-border shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t("delivery")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="whitespace-pre-line text-foreground">{order.deliveryAddress}</p>
                    {order.note ? (
                      <p className="text-muted-foreground">
                        {t("note")}: {order.note}
                      </p>
                    ) : null}
                    <Row
                      label={t("total")}
                      value={
                        order.netTotalFromSource != null
                          ? formatMoney(
                              order.netTotalFromSource,
                              order.currency ?? "EUR",
                              locale === "de" ? "de-DE" : "en-US",
                            )
                          : "—"
                      }
                    />
                    {order.lastSubmitError ? (
                      <Alert variant="destructive" className="mt-2">
                        <AlertDescription>{order.lastSubmitError}</AlertDescription>
                      </Alert>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t("items")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="shop-order-items">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">{t("article")}</th>
                          <th className="py-2 pr-3 font-medium">{t("qty")}</th>
                          <th className="py-2 pr-3 font-medium">{t("unitPrice")}</th>
                          <th className="py-2 font-medium">{t("lineTotal")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => {
                          const qty = item.quantityConfirmed ?? item.quantity;
                          const line =
                            item.unitPrice != null ? item.unitPrice * qty : null;
                          return (
                            <tr key={item.id} className="border-b border-border/60">
                              <td className="py-2 pr-3">
                                <p className="font-medium text-foreground">{item.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.articleNumber}
                                  {item.gtin ? ` · ${item.gtin}` : ""}
                                </p>
                              </td>
                              <td className="py-2 pr-3 tabular-nums">{qty}</td>
                              <td className="py-2 pr-3 tabular-nums">
                                {item.unitPrice != null
                                  ? formatMoney(
                                      item.unitPrice,
                                      order.currency ?? "EUR",
                                      locale === "de" ? "de-DE" : "en-US",
                                    )
                                  : "—"}
                              </td>
                              <td className="py-2 tabular-nums">
                                {line != null
                                  ? formatMoney(
                                      line,
                                      order.currency ?? "EUR",
                                      locale === "de" ? "de-DE" : "en-US",
                                    )
                                  : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <PriceBreakdown order={order} moneyLocale={locale === "de" ? "de-DE" : "en-US"} />
                </CardContent>
              </Card>

              <Card className="border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t("statusHistory")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {!order.statusEvents?.length ? (
                    <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
                  ) : (
                    <ul className="space-y-3" data-testid="shop-order-events">
                      {order.statusEvents.map((ev) => (
                        <li key={ev.id} className="border-b border-border/60 pb-2 text-sm last:border-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={stateVariant(ev.externalState)}>
                              {tStatus(ev.externalState as "ordered")}
                            </Badge>
                            <span className="text-muted-foreground">
                              {formatDateTime(ev.receivedAt, locale)}
                            </span>
                          </div>
                          <p className="mt-1 text-muted-foreground">
                            {t("eventSource", { source: ev.source })}
                            {ev.actorName ? ` · ${ev.actorName}` : ""}
                            {ev.invoiceRef ? ` · ${ev.invoiceRef}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </ListPageShell>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function PriceBreakdown({
  order,
  moneyLocale,
}: {
  order: OrderRequestDTO;
  moneyLocale: string;
}) {
  const t = useTranslations("pages.shopOrders.detail");
  const currency = order.priceBreakdown?.currency ?? order.currency ?? "EUR";
  const money = (n: number) => formatMoney(n, currency, moneyLocale);

  let computedItemsNet: number | null = 0;
  for (const item of order.items) {
    if (item.unitPrice == null) {
      computedItemsNet = null;
      break;
    }
    computedItemsNet += item.unitPrice * (item.quantityConfirmed ?? item.quantity);
  }

  const bd = order.priceBreakdown;
  const netSubtotal = bd?.netSubtotal ?? computedItemsNet;
  const vat = bd?.vat ?? null;
  const grossSubtotal = bd?.grossSubtotal ?? null;
  const shipping = bd?.shipping ?? null;
  const total = bd?.total ?? order.netTotalFromSource ?? null;

  if (netSubtotal == null && vat == null && shipping == null && total == null) return null;

  return (
    <dl
      className="mt-4 ml-auto w-full max-w-xs space-y-1.5 border-t border-border pt-3 text-sm"
      data-testid="shop-order-price-breakdown"
    >
      {netSubtotal != null ? (
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">{t("netSubtotal")}</dt>
          <dd className="tabular-nums text-foreground">{money(netSubtotal)}</dd>
        </div>
      ) : null}
      {vat != null ? (
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">{t("vat")}</dt>
          <dd className="tabular-nums text-foreground">{money(vat)}</dd>
        </div>
      ) : null}
      {grossSubtotal != null ? (
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">{t("grossSubtotal")}</dt>
          <dd className="tabular-nums text-foreground">{money(grossSubtotal)}</dd>
        </div>
      ) : null}
      {shipping != null ? (
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">{t("shipping")}</dt>
          <dd className="tabular-nums text-foreground">{money(shipping)}</dd>
        </div>
      ) : null}
      {total != null ? (
        <div className="flex justify-between gap-6 border-t border-border pt-1.5 font-semibold">
          <dt>{t("total")}</dt>
          <dd className="tabular-nums" data-testid="shop-order-price-total">
            {money(total)}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
