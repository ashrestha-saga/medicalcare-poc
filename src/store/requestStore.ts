"use client";

import { create } from "zustand";
import type { CartItemDTO, ClassificationProposalDTO, PhotoDraft, SparePartDTO } from "@/interfaces";
import { INSPECTION_TYPES } from "@/constants/inspectionTypes";
import { addToCart, removeFromCart, setQuantity } from "@/lib/cart";
import { newClientId } from "@/lib/http/apiClient";

/**
 * In-progress form state for the service request and the spare-parts cart.
 * The idempotency key is minted once per form session and reused for every
 * retry of that submission (SS-701).
 */

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
  /** Codes the user ticked in the full inspection list (FA-404). */
  selectedTypes: string[];
  proposalConfirmed: boolean;
  photos: PhotoDraft[];
}

interface RequestState {
  form: ServiceFormState;
  cart: CartItemDTO[];
  orderIdempotencyKey: string;
  orderNote: string;

  patch(partial: Partial<ServiceFormState>): void;
  toggleType(code: string): void;
  /** FA-403 — apply a proposal: verified pre-selects, derived/guess only display. */
  applyProposal(proposal: ClassificationProposalDTO | null | undefined): void;
  addPhoto(photo: PhotoDraft): void;
  removePhoto(id: string): void;
  prefillLocation(input: { siteId?: string | null; areaId?: string | null; room?: string | null; deliveryAddress?: string | null }): void;
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
    selectedTypes: [],
    proposalConfirmed: false,
    photos: [],
  };
}

/** Maps a proposal onto inspection-type codes it suggests. Pure; unit-tested. */
export function proposalSuggestedCodes(proposal: ClassificationProposalDTO | null | undefined): string[] {
  if (!proposal) return [];
  return INSPECTION_TYPES.filter((t) => {
    switch (t.proposalKey) {
      case "annex1":
        return proposal.annex1 === true;
      case "annex2":
        return proposal.annex2 === true;
      case "softwareClass":
        return proposal.softwareClass !== null;
      case "radiation":
        return proposal.radiation === true;
      default:
        return false;
    }
  }).map((t) => t.code);
}

export const useRequestStore = create<RequestState>()((set) => ({
  form: freshForm(),
  cart: [],
  orderIdempotencyKey: newClientId(),
  orderNote: "",

  patch: (partial) => set((s) => ({ form: { ...s.form, ...partial } })),
  toggleType: (code) =>
    set((s) => {
      const selected = s.form.selectedTypes.includes(code)
        ? s.form.selectedTypes.filter((c) => c !== code)
        : [...s.form.selectedTypes, code];
      return { form: { ...s.form, selectedTypes: selected, serviceType: selected[0] ?? null } };
    }),
  applyProposal: (proposal) =>
    set((s) => {
      // Only a `verified` proposal pre-selects (FA-403). Nothing is ever removed from the list.
      const preselect = proposal?.confidence === "verified" ? proposalSuggestedCodes(proposal) : [];
      return { form: { ...s.form, selectedTypes: preselect, serviceType: preselect[0] ?? null, proposalConfirmed: false } };
    }),
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
