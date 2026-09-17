"use client";

import { useCallback, useState } from "react";
import type { CreateOrderRequestDTO, CreateOrderRequestResult } from "@/interfaces";
import { api, ApiError, NetworkError, isOffline, newClientId } from "@/lib/http/apiClient";
import { itemCount, toOrderItems } from "@/lib/cart";
import { useRequestStore } from "@/store/requestStore";
import { currentSubject, useScanStore } from "@/store/scanStore";
import { useSessionStore } from "@/store/sessionStore";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { useLogStore } from "@/store/logStore";
import { toast } from "@/store/toastStore";

/**
 * Builds and submits a spare-parts order request (online or offline queue).
 */
export function useSubmitOrderRequest() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const phase = useScanStore((s) => s.phase);
  const resolution = useScanStore((s) => s.resolution);
  const captured = useScanStore((s) => s.captured);
  const submitting = useScanStore((s) => s.submitting);
  const succeeded = useScanStore((s) => s.succeeded);
  const queuedPhase = useScanStore((s) => s.queued);
  const cart = useRequestStore((s) => s.cart);
  const orderNote = useRequestStore((s) => s.orderNote);
  const orderKey = useRequestStore((s) => s.orderIdempotencyKey);
  const resetCart = useRequestStore((s) => s.resetCart);
  const deliveryAddress = useRequestStore((s) => s.form.deliveryAddress);
  const enqueueOrder = useOfflineQueueStore((s) => s.enqueueOrderRequest);
  const user = useSessionStore((s) => s.user);
  const count = itemCount(cart);
  const busy = phase === "submitting";

  const submit = useCallback(async () => {
    if (!user) return;
    if (!deliveryAddress.trim()) {
      toast.error("Please enter the delivery address.");
      return;
    }
    const subject = currentSubject({ resolution, captured });
    const payload: CreateOrderRequestDTO = {
      idempotencyKey: orderKey,
      subjectType: subject?.subjectType,
      subjectId: subject?.subjectId,
      deliveryAddress: deliveryAddress.trim(),
      note: orderNote.trim() || undefined,
      items: toOrderItems(cart),
      raisedBy: user.name,
      correlationId: newClientId(),
    };
    setConfirmOpen(false);
    submitting();
    const log = useLogStore.getState().log;
    const queueIt = async () => {
      await enqueueOrder(payload, `order request (${count} item${count === 1 ? "" : "s"})`);
      queuedPhase({ kind: "order-request", reference: "", state: "queued", idempotencyKey: orderKey, queued: true });
      toast.info("Request saved locally. It will be sent when the connection returns.");
      resetCart();
    };
    if (isOffline()) return queueIt();
    try {
      const res = await api<CreateOrderRequestResult>("/api/order-requests", {
        method: "POST",
        body: JSON.stringify(payload),
        correlationId: payload.correlationId,
      });
      log("request", `Order request ${res.order.reference} (${res.order.approvalState})`);
      succeeded({
        kind: "order-request",
        reference: res.order.reference,
        state: res.order.approvalState,
        idempotencyKey: orderKey,
        queued: false,
      });
      resetCart();
    } catch (e) {
      if (e instanceof NetworkError) return queueIt();
      toast.error(e instanceof ApiError ? e.message : "Could not submit the order request.");
      useScanStore.getState().openParts();
    }
  }, [
    user,
    deliveryAddress,
    resolution,
    captured,
    orderKey,
    orderNote,
    cart,
    submitting,
    enqueueOrder,
    count,
    queuedPhase,
    resetCart,
    succeeded,
  ]);

  return { confirmOpen, setConfirmOpen, submit, busy, count };
}
