"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cartTotal, formatMoney, itemCount } from "@/lib/cart";
import { useRequestStore } from "@/store/requestStore";
import { useScanStore } from "@/store/scanStore";
import { DeviceHeader } from "@/components/features/device/DeviceHeader";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Loading";
import { usePartsSearch } from "@/components/hooks/cart/usePartsSearch";
import { useSubmitOrderRequest } from "@/components/hooks/cart/useSubmitOrderRequest";
import { useDeviceShopArticles } from "@/components/hooks/cart/useDeviceShopArticles";
import { useShopAccount } from "@/components/hooks/cart/useShopAccount";
import { useShopOrderFlow } from "@/components/hooks/cart/useShopOrderFlow";
import { scanResumePath, shopPathForDevice } from "@/lib/scan/shopNavigation";
import { QtyStepper } from "./QtyStepper";

/**
 * Spare-parts / shop order flow.
 * When shop ordering is available for the device, shows shop articles + PIN submit.
 * Otherwise falls back to local approval order requests.
 */
export function PartsScreen() {
  const t = useTranslations("parts");
  const tCommon = useTranslations("common");
  const resolution = useScanStore((s) => s.resolution);
  const captured = useScanStore((s) => s.captured);
  const backToDevice = useScanStore((s) => s.backToDevice);
  const cart = useRequestStore((s) => s.cart);
  const addPart = useRequestStore((s) => s.addPart);
  const setPartQty = useRequestStore((s) => s.setPartQty);
  const orderNote = useRequestStore((s) => s.orderNote);
  const setOrderNote = useRequestStore((s) => s.setOrderNote);
  const deliveryAddress = useRequestStore((s) => s.form.deliveryAddress);
  const patchForm = useRequestStore((s) => s.patch);

  const deviceInstanceId =
    resolution?.device?.id && resolution.source.system === "device-inventory"
      ? resolution.device.id
      : undefined;
  const modelId = resolution?.model?.id ?? resolution?.device?.modelId ?? undefined;

  const [query, setQuery] = useState("");
  const [shopMode, setShopMode] = useState(true);
  const shop = useDeviceShopArticles(deviceInstanceId, Boolean(deviceInstanceId) && shopMode);
  /** Shop-led path when viewing an inventory device and shop catalog is reachable. */
  const shopOrdering = Boolean(deviceInstanceId) && shopMode && !shop.error;
  const shopAccount = useShopAccount(shopOrdering);

  const { parts, source, loading } = usePartsSearch(query, modelId);
  const legacy = useSubmitOrderRequest();
  const shopFlow = useShopOrderFlow({
    hasSubUsers: shopAccount.hasSubUsers || shop.hasSubUsers,
    purpose: "parts",
    deliveryAddressId: shopAccount.selectedAddressId,
    deliveryAddressLabel: shopAccount.selectedAddress?.label ?? null,
  });

  const displayParts = shopOrdering && !query.trim() && shop.shopParts.length
    ? shop.shopParts
    : parts;
  const listLoading = shopOrdering && !query.trim() ? shop.loading : loading;
  const sourceLabel =
    shopOrdering && shop.source
      ? shop.source === "mock"
        ? t("sourceOxidMock")
        : shop.source
      : source === "oxid-mock"
        ? t("sourceOxidMock")
        : source;

  const total = useMemo(() => cartTotal(cart), [cart]);
  const cartCount = itemCount(cart);
  const busy = shopOrdering ? shopFlow.busy : legacy.busy;

  return (
    <div data-testid="parts-screen">
      <DeviceHeader
        resolution={resolution}
        captured={captured}
        actions={
          <button type="button" className="p-close" onClick={backToDevice} aria-label={t("backAria")}>
            ×
          </button>
        }
      />

      <div className="p-sec">
        <p className="p-sec-title">
          {shopOrdering ? t("shopSectionTitle") : t("sectionTitle")}
          {sourceLabel ? ` · ${sourceLabel}` : ""}
        </p>
        {deviceInstanceId ? (
          <div className="p-settings__actions" style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`p-cta ghost${shopMode ? "" : ""}`}
              style={{ width: "auto", minHeight: 32, padding: "0 10px", fontSize: 12 }}
              onClick={() => setShopMode((v) => !v)}
              data-testid="toggle-shop-mode"
            >
              {shopMode ? t("showCatalogSearch") : t("showShopArticles")}
            </button>
            <Link
              href={shopPathForDevice(deviceInstanceId, scanResumePath(deviceInstanceId), {
                tab: "accessories",
              })}
              className="p-cta ghost"
              style={{ width: "auto", minHeight: 32, padding: "0 10px", fontSize: 12, display: "inline-flex", alignItems: "center" }}
              title={t("openFullShopHint")}
              data-testid="open-full-shop"
            >
              {t("openFullShop")}
            </Link>
          </div>
        ) : null}
        {shop.error && shopMode ? (
          <p className="p-lead" data-s="manual" style={{ marginBottom: 10 }}>
            {shop.error}
          </p>
        ) : null}
        <div className="p-field">
          <input
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="parts-search"
          />
        </div>
        {listLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <Spinner />
          </div>
        ) : displayParts.length === 0 ? (
          <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--on-dark-soft)", padding: 16 }}>
            {t("noPartsFound")}
          </p>
        ) : (
          <div>
            {displayParts.map((p) => {
              const inCart = cart.find((c) => c.part.id === p.id)?.quantity ?? 0;
              return (
                <div key={p.id} className="p-part" data-testid={`part-${p.articleNumber}`}>
                  <div>
                    <b>{p.description}</b>
                    <span>
                      {p.articleNumber}
                      {p.unitPrice !== null && ` · ${formatMoney(p.unitPrice, p.currency)}`}
                    </span>
                  </div>
                  {inCart > 0 ? (
                    <QtyStepper value={inCart} onChange={(q) => setPartQty(p.id, q)} />
                  ) : (
                    <button
                      type="button"
                      className="p-cta ghost"
                      style={{ width: "auto", minHeight: 36, padding: "0 12px", fontSize: 12 }}
                      onClick={() => addPart(p)}
                      data-testid={`add-${p.articleNumber}`}
                    >
                      {t("add")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="p-sec" data-testid="cart">
          <p className="p-sec-title">
            {shopOrdering
              ? t("shopOrderTitle", { count: cartCount })
              : t("orderRequestTitle", { count: cartCount })}
          </p>
          {cart.map((c) => (
            <div key={c.part.id} className="p-part">
              <div>
                <b>
                  {c.quantity} × {c.part.description}
                </b>
              </div>
              <span className="t-mono" style={{ fontSize: 11, color: "var(--on-dark-soft)" }}>
                {c.part.unitPrice !== null
                  ? formatMoney(c.part.unitPrice * c.quantity, c.part.currency)
                  : tCommon("dash")}
              </span>
            </div>
          ))}
          <div className="p-sum">
            <span>{t("estimatedTotal")}</span>
            <b data-testid="cart-total">
              {total ? formatMoney(total.amount, total.currency) : t("onRequest")}
            </b>
          </div>
          {shopOrdering ? (
            <div className="p-field">
              <label htmlFor="shop-delivery-address">
                {t("shopDeliveryAddress")}{" "}
                <span className="p-req" aria-hidden="true">
                  *
                </span>
              </label>
              {shopAccount.loading ? (
                <div className="p-wait" style={{ padding: 8 }}>
                  <Spinner />
                </div>
              ) : shopAccount.error ? (
                <p className="p-lead" data-s="manual" style={{ margin: 0 }}>
                  {shopAccount.error}
                </p>
              ) : shopAccount.addresses.length === 0 ? (
                <p className="p-lead" data-s="manual" style={{ margin: 0 }}>
                  {t("shopDeliveryEmpty")}
                </p>
              ) : (
                <select
                  id="shop-delivery-address"
                  value={shopAccount.selectedAddressId ?? ""}
                  onChange={(e) => shopAccount.setSelectedAddressId(e.target.value || null)}
                  data-testid="shop-delivery-address"
                >
                  {shopAccount.addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="p-field">
              <label htmlFor="order-delivery">
                {t("deliveryAddress")}{" "}
                <span className="p-req" aria-hidden="true">
                  *
                </span>
              </label>
              <textarea
                id="order-delivery"
                value={deliveryAddress}
                onChange={(e) => patchForm({ deliveryAddress: e.target.value })}
                data-testid="order-delivery"
              />
            </div>
          )}
          <div className="p-field">
            <label htmlFor="order-note">{t("note")}</label>
            <input id="order-note" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
          </div>
          <p className="p-lead" data-s="manual" data-testid="approval-notice" style={{ margin: "0 0 14px" }}>
            {shopOrdering
              ? t.rich("shopOrderNotice", { strong: (chunks) => <strong>{chunks}</strong> })
              : t.rich("approvalNotice", { strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
          <button
            type="button"
            className="p-cta"
            onClick={() => (shopOrdering ? shopFlow.startConfirm() : legacy.setConfirmOpen(true))}
            disabled={busy}
            data-testid="submit-order"
          >
            {busy ? <Spinner /> : shopOrdering ? t("placeShopOrder") : t("submitOrderRequest")}
          </button>
        </div>
      )}

      {/* Legacy confirm */}
      <Modal
        open={!shopOrdering && legacy.confirmOpen}
        title={t("confirmTitle")}
        onClose={() => legacy.setConfirmOpen(false)}
        footer={
          <>
            <button type="button" className="p-cta ghost" onClick={() => legacy.setConfirmOpen(false)}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className="p-cta"
              onClick={() => void legacy.submit()}
              data-testid="confirm-order"
            >
              {t("submitForApproval")}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13 }}>{t("confirmBody", { count: legacy.count })}</p>
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
          {deliveryAddress || tCommon("dash")}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--warn)", marginTop: 10 }}>{t("approvalWarn")}</p>
      </Modal>

      {/* Shop confirm */}
      <Modal
        open={shopOrdering && shopFlow.flow === "confirm"}
        title={t("shopConfirmTitle")}
        onClose={shopFlow.closeModals}
        footer={
          <>
            <button type="button" className="p-cta ghost" onClick={shopFlow.closeModals}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className="p-cta"
              onClick={() => void shopFlow.createIntentAndContinue()}
              data-testid="confirm-shop-order"
            >
              {shop.hasSubUsers ? t("continueToPin") : t("placeShopOrder")}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13 }}>{t("shopConfirmBody", { count: shopFlow.count })}</p>
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

      {/* PIN */}
      <Modal
        open={shopOrdering && shopFlow.flow === "pin"}
        title={t("pinTitle")}
        onClose={shopFlow.closeModals}
        footer={
          <>
            <button type="button" className="p-cta ghost" onClick={shopFlow.closeModals}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className="p-cta"
              onClick={() => void shopFlow.confirmPin()}
              data-testid="confirm-pin"
              disabled={busy}
            >
              {busy ? <Spinner /> : t("placeShopOrder")}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, marginBottom: 10 }}>{t("pinBody")}</p>
        <div className="p-field">
          <label htmlFor="shop-pin">{t("pinLabel")}</label>
          <input
            id="shop-pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={shopFlow.pin}
            onChange={(e) => shopFlow.setPin(e.target.value)}
            data-testid="shop-pin"
          />
        </div>
      </Modal>

      {/* Non-empty basket */}
      <Modal
        open={shopOrdering && shopFlow.flow === "basket"}
        title={t("basketTitle")}
        onClose={shopFlow.closeModals}
        footer={
          <>
            <button type="button" className="p-cta ghost" onClick={shopFlow.closeModals}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className="p-cta"
              onClick={() => void shopFlow.clearBasketAndRetry()}
              data-testid="clear-basket-retry"
            >
              {t("clearBasketRetry")}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13 }}>{t("basketBody")}</p>
      </Modal>
    </div>
  );
}
