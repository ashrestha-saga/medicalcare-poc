"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ShopArticleDTO } from "@/interfaces/shop";
import { useDeviceShopCatalog } from "@/components/hooks/shop/useDeviceShopCatalog";
import { useShopAccount } from "@/components/hooks/cart/useShopAccount";
import { useShopOrderFlow } from "@/components/hooks/cart/useShopOrderFlow";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/Loading";
import { Modal } from "@/components/ui/Modal";
import { cartTotal, formatMoney, itemCount } from "@/lib/cart";
import { QtyStepper } from "@/components/features/cart/QtyStepper";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { safeAppPath } from "@/lib/scan/shopNavigation";
import { cn } from "@/lib/utils";
import { useRequestStore } from "@/store/requestStore";
import { ShopArticleCard, toSparePart } from "./ShopArticleCard";
import { ShopOrderSuccess } from "./ShopOrderSuccess";

type TabId = "device" | "accessories" | "suggestions";

export function ShopScreen() {
  const t = useTranslations("pages.shop");
  const tCommon = useTranslations("common");
  const tParts = useTranslations("parts");
  const search = useSearchParams();
  const deviceId = search.get("device")?.trim() || undefined;
  const tabParam = search.get("tab") as TabId | null;
  const backHref =
    safeAppPath(search.get("returnTo")) ??
    (deviceId ? `/devices?id=${encodeURIComponent(deviceId)}` : "/devices");

  const { checkPermission } = usePermissions();
  const isCapturer = !checkPermission("shell:nav") && checkPermission("inventory:view");
  const inventoryHref = isCapturer ? "/" : "/devices";

  const catalog = useDeviceShopCatalog(deviceId);
  const shopAccount = useShopAccount(Boolean(deviceId) && !catalog.error);
  const cart = useRequestStore((s) => s.cart);
  const addPart = useRequestStore((s) => s.addPart);
  const setPartQty = useRequestStore((s) => s.setPartQty);
  const orderNote = useRequestStore((s) => s.orderNote);
  const setOrderNote = useRequestStore((s) => s.setOrderNote);

  const purpose = useMemo<"device" | "parts">(() => {
    if (!cart.length) return "parts";
    return cart.every((c) => c.part.category === "device") ? "device" : "parts";
  }, [cart]);

  const shopFlow = useShopOrderFlow({
    hasSubUsers: shopAccount.hasSubUsers || catalog.data?.hasSubUsers === true,
    purpose,
    deviceInstanceId: deviceId,
    deliveryAddressId: shopAccount.selectedAddressId,
    deliveryAddressLabel: shopAccount.selectedAddress?.label ?? null,
  });

  const defaultTab: TabId = useMemo(() => {
    if (tabParam === "device" || tabParam === "accessories" || tabParam === "suggestions") return tabParam;
    if ((catalog.data?.accessoryCount ?? 0) > 0) return "accessories";
    return "device";
  }, [tabParam, catalog.data?.accessoryCount]);

  const [tab, setTab] = useState<TabId | null>(null);
  const activeTab = tab ?? defaultTab;

  // Lazy-load tab sections once; cached thereafter.
  useEffect(() => {
    if (!catalog.data) return;
    if (activeTab === "accessories" || activeTab === "suggestions") {
      void catalog.ensureSection(activeTab);
    }
  }, [activeTab, catalog.data, catalog.ensureSection]);

  const total = useMemo(() => cartTotal(cart), [cart]);
  const cartCount = itemCount(cart);
  const busy = shopFlow.busy;

  const qtyFor = (id: string) => cart.find((c) => c.part.id === id)?.quantity ?? 0;
  const addArticle = (article: ShopArticleDTO) => addPart(toSparePart(article));
  const qtyForCard = (article: ShopArticleDTO) =>
    article.hasVariants || (article.variants && article.variants.length > 0) ? 0 : qtyFor(article.id);

  const deviceArticles: ShopArticleDTO[] = useMemo(() => {
    if (!catalog.data?.primary) return catalog.data?.variants ?? [];
    const primary = catalog.data.primary;
    const variants = catalog.data.variants.filter((v) => v.id !== primary.id);
    return [primary, ...variants];
  }, [catalog.data]);

  const list: ShopArticleDTO[] =
    activeTab === "device"
      ? deviceArticles
      : activeTab === "accessories"
        ? (catalog.data?.accessories ?? [])
        : (catalog.data?.suggestions ?? []);

  const sectionLoading =
    (activeTab === "accessories" || activeTab === "suggestions") &&
    catalog.sectionStatus[activeTab] === "loading";
  const sectionErr =
    (activeTab === "accessories" || activeTab === "suggestions") &&
    catalog.sectionStatus[activeTab] === "error"
      ? catalog.sectionError[activeTab]
      : null;

  const onVariantsLoaded = (articleId: string, variants: ShopArticleDTO[]) => {
    catalog.patchArticle(articleId, { variants, hasVariants: variants.length > 0 });
  };

  if (shopFlow.success) {
    return (
      <div className="p-work" data-testid="shop-page">
        <main className="p-main">
          <ListPageShell title={t("title")} description={t("success.shellDescription")} testId="shop-screen">
            <ShopOrderSuccess
              success={shopFlow.success}
              inventoryHref={inventoryHref}
              onDone={shopFlow.dismissSuccess}
            />
          </ListPageShell>
        </main>
      </div>
    );
  }

  if (!deviceId) {
    return (
      <div className="p-work" data-testid="shop-page">
        <main className="p-main">
          <ListPageShell title={t("title")} description={t("pickDevice")} testId="shop-screen">
            <Alert>
              <AlertDescription>
                {t("needDevice")}{" "}
                <Link href="/devices" className="underline underline-offset-2">
                  {t("openInventory")}
                </Link>
              </AlertDescription>
            </Alert>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="shop-page">
      <main className="p-main">
        <ListPageShell
          title={t("title")}
          description={catalog.data?.deviceInstance.label ?? t("description")}
          testId="shop-screen"
          headerExtra={
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={backHref}>{t("backDevice")}</Link>
            </Button>
          }
        >
          {catalog.loading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : null}

          {catalog.error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{catalog.error}</AlertDescription>
            </Alert>
          ) : null}

          {!catalog.loading && catalog.data ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
              <div className="min-w-0 space-y-4">
                {!catalog.data.primary ? (
                  <Alert>
                    <AlertDescription>{t("noMatch")}</AlertDescription>
                  </Alert>
                ) : null}

                {catalog.data.categories.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {catalog.data.categories.map((c) => c.title).join(" · ")}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2 border-b border-border pb-2" role="tablist">
                  {(
                    [
                      { id: "device" as const, label: t("tabDevice"), count: deviceArticles.length },
                      {
                        id: "accessories" as const,
                        label: t("tabAccessories"),
                        count: catalog.data.accessoryCount,
                      },
                      {
                        id: "suggestions" as const,
                        label: t("tabSuggestions"),
                        count: catalog.data.suggestionCount,
                      },
                    ] as const
                  )
                    .filter((tabDef) => tabDef.id === "device" || tabDef.id === "accessories" || tabDef.count > 0)
                    .map((tabDef) => (
                      <button
                        key={tabDef.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tabDef.id}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                          activeTab === tabDef.id
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                        onClick={() => setTab(tabDef.id)}
                        data-testid={`shop-tab-${tabDef.id}`}
                      >
                        {tabDef.label}
                        <span className="ml-1.5 tabular-nums opacity-70">{tabDef.count}</span>
                      </button>
                    ))}
                </div>

                <div className="space-y-3" data-testid={`shop-tab-panel-${activeTab}`}>
                  {sectionLoading ? (
                    <div className="flex justify-center py-10">
                      <Spinner />
                    </div>
                  ) : null}
                  {sectionErr ? (
                    <Alert variant="destructive">
                      <AlertDescription>{sectionErr}</AlertDescription>
                    </Alert>
                  ) : null}
                  {!sectionLoading && !sectionErr && list.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                      {activeTab === "accessories" ? t("emptyAccessories") : t("emptyTab")}
                    </p>
                  ) : null}
                  {!sectionLoading && !sectionErr
                    ? list.map((article) => (
                        <ShopArticleCard
                          key={article.id}
                          article={article}
                          quantity={qtyForCard(article)}
                          onAdd={(toAdd) => addArticle(toAdd)}
                          onQty={(q) => setPartQty(article.id, q)}
                          emphasize={activeTab === "device" && article.id === catalog.data.primary?.id}
                          onVariantsLoaded={onVariantsLoaded}
                        />
                      ))
                    : null}
                </div>
              </div>

              <aside className="lg:sticky lg:top-4" data-testid="shop-cart-aside">
                <Card className="border-border shadow-none" data-testid="shop-cart">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t("cartTitle", { count: cartCount })}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {cart.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("cartEmpty")}</p>
                    ) : (
                      <>
                        <div className="max-h-[min(50vh,28rem)] space-y-3 overflow-y-auto pr-1">
                          {cart.map((c) => (
                            <div key={c.part.id} className="flex items-start justify-between gap-3 text-sm">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{c.part.description}</p>
                                <p className="text-xs text-muted-foreground">{c.part.articleNumber}</p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-2">
                                <QtyStepper value={c.quantity} onChange={(q) => setPartQty(c.part.id, q)} />
                                <span className="tabular-nums text-xs">
                                  {c.part.unitPrice != null
                                    ? formatMoney(c.part.unitPrice * c.quantity, c.part.currency)
                                    : "—"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
                          <span>{t("total")}</span>
                          <span data-testid="shop-cart-total">
                            {total ? formatMoney(total.amount, total.currency) : t("priceOnRequest")}
                          </span>
                        </div>
                      </>
                    )}

                    {shopAccount.addresses.length > 0 ? (
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground" htmlFor="shop-delivery">
                          {t("deliveryAddress")}
                        </label>
                        <select
                          id="shop-delivery"
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                          value={shopAccount.selectedAddressId ?? ""}
                          onChange={(e) => shopAccount.setSelectedAddressId(e.target.value || null)}
                          data-testid="shop-delivery-select"
                        >
                          {shopAccount.addresses.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground" htmlFor="shop-note">
                        {t("note")}
                      </label>
                      <input
                        id="shop-note"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                      />
                    </div>

                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => shopFlow.startConfirm()}
                      disabled={busy || cart.length === 0}
                      data-testid="shop-checkout"
                    >
                      {busy ? <Spinner /> : t("checkout")}
                    </Button>
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : null}
        </ListPageShell>
      </main>

      <Modal
        open={shopFlow.flow === "confirm"}
        title={tParts("shopConfirmTitle")}
        onClose={shopFlow.closeModals}
        footer={
          <>
            <button type="button" className="p-cta ghost" onClick={shopFlow.closeModals}>
              {tParts("cancel")}
            </button>
            <button
              type="button"
              className="p-cta"
              onClick={() => void shopFlow.createIntentAndContinue()}
              data-testid="confirm-shop-order"
            >
              {shopAccount.hasSubUsers || catalog.data?.hasSubUsers
                ? tParts("continueToPin")
                : tParts("placeShopOrder")}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13 }}>{tParts("shopConfirmBody", { count: shopFlow.count })}</p>
        <p
          style={{
            whiteSpace: "pre-line",
            background: "var(--navy)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 12,
            fontSize: 12.5,
            marginTop: 10,
          }}
        >
          {shopFlow.deliveryText || tCommon("dash")}
        </p>
      </Modal>

      <Modal
        open={shopFlow.flow === "pin"}
        title={tParts("pinTitle")}
        onClose={shopFlow.closeModals}
        footer={
          <>
            <button type="button" className="p-cta ghost" onClick={shopFlow.closeModals}>
              {tParts("cancel")}
            </button>
            <button
              type="button"
              className="p-cta"
              onClick={() => void shopFlow.confirmPin()}
              data-testid="confirm-pin"
              disabled={busy}
            >
              {busy ? <Spinner /> : tParts("placeShopOrder")}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, marginBottom: 10 }}>{tParts("pinBody")}</p>
        <div className="p-field">
          <label htmlFor="shop-page-pin">{tParts("pinLabel")}</label>
          <input
            id="shop-page-pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={shopFlow.pin}
            onChange={(e) => shopFlow.setPin(e.target.value)}
            data-testid="shop-pin"
          />
        </div>
      </Modal>

      <Modal
        open={shopFlow.flow === "basket"}
        title={tParts("basketTitle")}
        onClose={shopFlow.closeModals}
        footer={
          <>
            <button type="button" className="p-cta ghost" onClick={shopFlow.closeModals}>
              {tParts("cancel")}
            </button>
            <button
              type="button"
              className="p-cta"
              onClick={() => void shopFlow.clearBasketAndRetry()}
              data-testid="clear-basket-retry"
            >
              {tParts("clearBasketRetry")}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13 }}>{tParts("basketBody")}</p>
      </Modal>
    </div>
  );
}
