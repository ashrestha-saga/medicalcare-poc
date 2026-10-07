"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cartTotal, formatMoney, itemCount } from "@/lib/cart";
import { useRequestStore } from "@/store/requestStore";
import { useScanStore } from "@/store/scanStore";
import { DeviceHeader } from "@/components/features/device/DeviceHeader";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Loading";
import { usePartsSearch } from "@/components/hooks/cart/usePartsSearch";
import { useSubmitOrderRequest } from "@/components/hooks/cart/useSubmitOrderRequest";
import { QtyStepper } from "./QtyStepper";

/**
 * Section 37 — spare-parts flow. Parts come from the OXID category search.
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

  const modelId = resolution?.model?.id ?? resolution?.device?.modelId ?? undefined;
  const [query, setQuery] = useState("");
  const { parts, source, loading } = usePartsSearch(query, modelId);
  const { confirmOpen, setConfirmOpen, submit, busy, count } = useSubmitOrderRequest();

  const total = useMemo(() => cartTotal(cart), [cart]);
  const cartCount = itemCount(cart);
  const sourceLabel = source === "oxid-mock" ? t("sourceOxidMock") : source;

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
          {t("sectionTitle")}
          {sourceLabel ? ` · ${sourceLabel}` : ""}
        </p>
        <div className="p-field">
          <input
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="parts-search"
          />
        </div>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <Spinner />
          </div>
        ) : parts.length === 0 ? (
          <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--on-dark-soft)", padding: 16 }}>
            {t("noPartsFound")}
          </p>
        ) : (
          <div>
            {parts.map((p) => {
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
          <p className="p-sec-title">{t("orderRequestTitle", { count: cartCount })}</p>
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
          <div className="p-field">
            <label htmlFor="order-delivery">
              {t("deliveryAddress")} <span className="p-req" aria-hidden="true">*</span>
            </label>
            <textarea
              id="order-delivery"
              value={deliveryAddress}
              onChange={(e) => patchForm({ deliveryAddress: e.target.value })}
              data-testid="order-delivery"
            />
          </div>
          <div className="p-field">
            <label htmlFor="order-note">{t("note")}</label>
            <input id="order-note" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
          </div>
          <p className="p-lead" data-s="manual" data-testid="approval-notice" style={{ margin: "0 0 14px" }}>
            {t.rich("approvalNotice", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <button
            type="button"
            className="p-cta"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
            data-testid="submit-order"
          >
            {busy ? <Spinner /> : t("submitOrderRequest")}
          </button>
        </div>
      )}

      <Modal
        open={confirmOpen}
        title={t("confirmTitle")}
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <button type="button" className="p-cta ghost" onClick={() => setConfirmOpen(false)}>
              {t("cancel")}
            </button>
            <button type="button" className="p-cta" onClick={() => void submit()} data-testid="confirm-order">
              {t("submitForApproval")}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13 }}>{t("confirmBody", { count })}</p>
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
    </div>
  );
}
