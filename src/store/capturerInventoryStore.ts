import { create } from "zustand";

/** Capturer (§user) Bestandsverzeichnis overlay — opened from the account bar. */
interface CapturerInventoryUiState {
  open: boolean;
  count: number | null;
  openPanel: () => void;
  closePanel: () => void;
  setCount: (count: number) => void;
}

export const useCapturerInventoryUi = create<CapturerInventoryUiState>((set) => ({
  open: false,
  count: null,
  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false }),
  setCount: (count) => set({ count }),
}));
