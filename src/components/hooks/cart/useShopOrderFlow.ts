"use client";

import { useCallback, useState } from "react";
import type { CreateOrderRequestDTO, CreateOrderRequestResult } from "@/interfaces";
import type { SubmitShopOrderResult } from "@/interfaces/shop";
import { api, ApiError, NetworkError, isOffline, newClientId } from "@/lib/http/apiClient";
import { cartTotal, formatMoney, itemCount, toOrderItems } from "@/lib/cart";
import { useRequestStore } from "@/store/requestStore";
import { currentSubject, useScanStore } from "@/store/scanStore";
import { useSessionStore } from "@/store/sessionStore";
import { useLogStore } from "@/store/logStore";
import { toast } from "@/store/toastStore";

type FlowState = "idle" | "confirm" | "pin" | "basket" | "submitting" | "success";

export type ShopOrderSuccessSnapshot = {
  reference: string;
  externalOrderRef: string | null;
  orderedByName: string | null;
  deliveryLabel: string;
  note: string | null;
  itemCount: number;
  lines: { description: string; articleNumber: string; quantity: number; lineTotal: string | null }[];
  totalLabel: string | null;
};

/**
 * Shop-led order: create intent → optional PIN → submit to shop Checkout API.
 * Intent create can queue offline; submit is online-only.
 */
export function useShopOrderFlow(opts: {
  hasSubUsers: boolean;
  purpose?: "device" | "parts";
  /** Explicit inventory device (e.g. /shop?device=) when scan resolution is absent. */
  deviceInstanceId?: string | null;
  /** Shop address id from oauthme — sent as delivery_address_id on submit. */
  deliveryAddressId?: string | null;
  /** Human-readable label for the local intent record. */
  deliveryAddressLabel?: string | null;
}) {
  const [flow, setFlow] = useState<FlowState>("idle");
  const [pin, setPin] = useState("");
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [lastOrderRef, setLastOrderRef] = useState<string | null>(null);
  const [success, setSuccess] = useState<ShopOrderSuccessSnapshot | null>(null);

  const phase = useScanStore((s) => s.phase);
  const resolution = useScanStore((s) => s.resolution);
  const captured = useScanStore((s) => s.captured);
  const submitting = useScanStore((s) => s.submitting);
  const succeeded = useScanStore((s) => s.succeeded);
  const cart = useRequestStore((s) => s.cart);
  const orderNote = useRequestStore((s) => s.orderNote);
  const orderKey = useRequestStore((s) => s.orderIdempotencyKey);
  const resetCart = useRequestStore((s) => s.resetCart);
  const deliveryAddress = useRequestStore((s) => s.form.deliveryAddress);
  const user = useSessionStore((s) => s.user);
  const count = itemCount(cart);
  const busy = phase === "submitting" || flow === "submitting";

  const resolvedDeliveryText =
    opts.deliveryAddressLabel?.trim() || deliveryAddress.trim();

  const closeModals = useCallback(() => {
    setFlow((f) => (f === "success" ? f : "idle"));
    setPin("");
  }, []);

  const dismissSuccess = useCallback(() => {
    setSuccess(null);
    setFlow("idle");
    setPin("");
  }, []);

  const submitToShop = useCallback(
    async (reference: string, pinValue?: string) => {
      setFlow("submitting");
      submitting();
      const log = useLogStore.getState().log;
      const snapshotCart = [...cart];
      const snapshotNote = orderNote.trim() || null;
      const snapshotDelivery = resolvedDeliveryText;
      const snapshotTotal = cartTotal(snapshotCart);
      try {
        const res = await api<SubmitShopOrderResult>(
          `/api/order-requests/${encodeURIComponent(reference)}/submit`,
          {
            method: "POST",
            body: JSON.stringify({
              pin: pinValue || undefined,
              clearBasket: true,
              deliveryAddressId: opts.deliveryAddressId || undefined,
            }),
          },
        );
        log("request", `Shop order ${res.order.externalOrderRef ?? res.order.reference}`);
        succeeded({
          kind: "order-request",
          reference: res.order.reference,
          state: res.order.externalState ?? "ordered",
          idempotencyKey: orderKey,
          queued: false,
        });
        setLastOrderRef(res.order.externalOrderRef);
        const shopTotal =
          res.order.netTotalFromSource != null && res.order.currency
            ? formatMoney(res.order.netTotalFromSource, res.order.currency)
            : snapshotTotal
              ? formatMoney(snapshotTotal.amount, snapshotTotal.currency)
              : null;
        setSuccess({
          reference: res.order.reference,
          externalOrderRef: res.order.externalOrderRef,
          orderedByName: res.order.orderedByName,
          deliveryLabel: snapshotDelivery,
          note: snapshotNote,
          itemCount: itemCount(snapshotCart),
          lines: snapshotCart.map((c) => ({
            description: c.part.description,
            articleNumber: c.part.articleNumber,
            quantity: c.quantity,
            lineTotal:
              c.part.unitPrice != null
                ? formatMoney(c.part.unitPrice * c.quantity, c.part.currency)
                : null,
          })),
          totalLabel: shopTotal,
        });
        resetCart();
        setPin("");
        setFlow("success");
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.code === "BASKET_NOT_EMPTY") {
            setPendingRef(reference);
            setFlow("basket");
            useScanStore.getState().openParts();
            return;
          }
          if (e.code === "PIN_INVALID" || e.status === 422) {
            setFlow("pin");
            toast.error(e.message);
            useScanStore.getState().openParts();
            return;
          }
        }
        toast.error(e instanceof ApiError ? e.message : "Could not place the shop order.");
        useScanStore.getState().openParts();
        setFlow(opts.hasSubUsers ? "pin" : "idle");
      }
    },
    [
      cart,
      orderKey,
      orderNote,
      opts.deliveryAddressId,
      opts.hasSubUsers,
      resetCart,
      resolvedDeliveryText,
      submitting,
      succeeded,
    ],
  );

  const startConfirm = useCallback(() => {
    if (!opts.deliveryAddressId) {
      toast.error("Please select a shop delivery address.");
      return;
    }
    if (!resolvedDeliveryText) {
      toast.error("Please select a shop delivery address.");
      return;
    }
    setFlow("confirm");
  }, [opts.deliveryAddressId, resolvedDeliveryText]);

  const createIntentAndContinue = useCallback(async () => {
    if (!user) return;
    if (!opts.deliveryAddressId) {
      toast.error("Please select a shop delivery address.");
      return;
    }
    const subject = currentSubject({ resolution, captured });
    const deviceId =
      opts.deviceInstanceId?.trim() ||
      (subject?.subjectType === "instance" ? subject.subjectId : undefined);
    const payload: CreateOrderRequestDTO = {
      idempotencyKey: orderKey,
      subjectType: deviceId ? "instance" : subject?.subjectType,
      subjectId: deviceId ?? subject?.subjectId,
      deliveryAddress: resolvedDeliveryText,
      note: orderNote.trim() || undefined,
      items: toOrderItems(cart),
      raisedBy: user.name,
      correlationId: newClientId(),
      purpose: opts.purpose ?? "parts",
      deviceInstanceId: deviceId,
    };
    setFlow("submitting");
    if (isOffline()) {
      toast.error("Shop order submit requires a connection. Save as a draft request when offline is supported.");
      setFlow("idle");
      return;
    }
    try {
      const res = await api<CreateOrderRequestResult>("/api/order-requests", {
        method: "POST",
        body: JSON.stringify(payload),
        correlationId: payload.correlationId,
      });
      setPendingRef(res.order.reference);
      if (opts.hasSubUsers) {
        setFlow("pin");
        return;
      }
      await submitToShop(res.order.reference);
    } catch (e) {
      if (e instanceof NetworkError) {
        toast.error("Shop ordering requires a live connection.");
      } else {
        toast.error(e instanceof ApiError ? e.message : "Could not create the order intent.");
      }
      setFlow("idle");
      useScanStore.getState().openParts();
    }
  }, [
    user,
    resolution,
    captured,
    orderKey,
    resolvedDeliveryText,
    orderNote,
    cart,
    opts.hasSubUsers,
    opts.purpose,
    opts.deviceInstanceId,
    opts.deliveryAddressId,
    submitToShop,
  ]);

  const confirmPin = useCallback(async () => {
    if (!pendingRef) return;
    if (!/^\d{3,11}$/.test(pin.trim())) {
      toast.error("Enter a valid PIN (3–11 digits).");
      return;
    }
    await submitToShop(pendingRef, pin.trim());
  }, [pendingRef, pin, submitToShop]);

  const clearBasketAndRetry = useCallback(async () => {
    if (!pendingRef) return;
    if (opts.hasSubUsers) {
      setFlow("pin");
      return;
    }
    await submitToShop(pendingRef);
  }, [pendingRef, opts.hasSubUsers, submitToShop]);

  return {
    flow,
    pin,
    setPin,
    busy,
    count,
    lastOrderRef,
    success,
    deliveryText: resolvedDeliveryText,
    startConfirm,
    createIntentAndContinue,
    confirmPin,
    clearBasketAndRetry,
    closeModals,
    dismissSuccess,
  };
}
