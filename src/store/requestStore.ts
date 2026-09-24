"use client";

import { create } from "zustand";
import type { CartItemDTO, PhotoDraft, SparePartDTO } from "@/interfaces";
import { addToCart, removeFromCart, setQuantity } from "@/lib/cart";
import { newClientId } from "@/lib/http/apiClient";

export type { PhotoDraft };

export interface ServiceFormState {
  idempotencyKey: string;
  serviceType: string | null;
  priority: "low" | "normal" | "high" | "critical";
  note: string;
  siteId: string;
  areaId: string;
  room: string;
  accessHint: string;
  contact: string;
  deliveryAddress: string;
  photos: PhotoDraft[];
}

interface RequestState {
  form: ServiceFormState;
  cart: CartItemDTO[];
  orderIdempotencyKey: string;
  orderNote: string;

  patch(partial: Partial<ServiceFormState>): void;
  addPhoto(photo: PhotoDraft): void;
  removePhoto(id: string): void;
  prefillLocation(input: {
    siteId?: string | null;
    areaId?: string | null;
    room?: string | null;
    deliveryAddress?: string | null;
  }): void;
  resetForm(): void;

  addPart(part: SparePartDTO, qty?: number): void;
  setPartQty(partId: string, qty: number): void;
  removePart(partId: string): void;
  setOrderNote(note: string): void;
  resetCart(): void;
}

function freshForm(): ServiceFormState {
  return {
    idempotencyKey: newClientId(),
    serviceType: null,
    priority: "normal",
    note: "",
    siteId: "",
    areaId: "",
    room: "",
    accessHint: "",
    contact: "",
    deliveryAddress: "",
    photos: [],
  };
}

export const useRequestStore = create<RequestState>()((set) => ({
  form: freshForm(),
  cart: [],
  orderIdempotencyKey: newClientId(),
  orderNote: "",

  patch: (partial) => set((s) => ({ form: { ...s.form, ...partial } })),
  addPhoto: (photo) => set((s) => ({ form: { ...s.form, photos: [...s.form.photos, photo].slice(0, 6) } })),
  removePhoto: (id) => set((s) => ({ form: { ...s.form, photos: s.form.photos.filter((p) => p.id !== id) } })),
  prefillLocation: (input) =>
    set((s) => ({
      form: {
        ...s.form,
        siteId: input.siteId ?? s.form.siteId,
        areaId: input.areaId ?? s.form.areaId,
        room: input.room ?? s.form.room,
        deliveryAddress: s.form.deliveryAddress || input.deliveryAddress || "",
      },
    })),
  resetForm: () => set({ form: freshForm() }),

  addPart: (part, qty = 1) => set((s) => ({ cart: addToCart(s.cart, part, qty) })),
  setPartQty: (partId, qty) => set((s) => ({ cart: setQuantity(s.cart, partId, qty) })),
  removePart: (partId) => set((s) => ({ cart: removeFromCart(s.cart, partId) })),
  setOrderNote: (note) => set({ orderNote: note }),
  resetCart: () => set({ cart: [], orderNote: "", orderIdempotencyKey: newClientId() }),
}));
